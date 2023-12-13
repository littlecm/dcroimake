from flask import Flask, request
import pandas as pd
import io

app = Flask(__name__)

# Custom function to read CSV files with 'Make' column
def read_csv_with_make(file_stream, make):
    df = pd.read_csv(file_stream)
    df['Make'] = make
    df = df[df['Lead Source'].notna()]
    return df

# Function to convert currency fields to numeric
def convert_currency_to_numeric(df, columns):
    for col in columns:
        df[col] = df[col].replace('[(]', '-', regex=True).replace('[\$,)]', '', regex=True).astype(float)
    return df

# Function to round small float numbers to zero
def round_small_to_zero(df, columns, threshold=1e-10):
    for col in columns:
        df[col] = df[col].apply(lambda x: 0 if abs(x) < threshold else x)
    return df

# Function to calculate 'Other' make values
def calculate_others(df_all, df_specifics):
    gross_columns = ['Total Front Gross', 'Total Back Gross', 'Total Gross']
    df_all = convert_currency_to_numeric(df_all, gross_columns)
    for make in df_specifics:
        df_specifics[make] = convert_currency_to_numeric(df_specifics[make], gross_columns)

    df_others = df_all.copy()
    for make, df_specific in df_specifics.items():
        df_specific_dropped = df_specific.drop('Make', axis=1)
        df_merged = df_others.merge(df_specific_dropped, on=['Lead Source', 'Type'], suffixes=('', f'_sub_{make}'), how='left')
        for col in df_specific_dropped.columns:
            if col not in ['Lead Source', 'Type'] and df_merged[col].dtype.kind in 'fi':
                df_merged[col] = df_merged[col].fillna(0) - df_merged[f'{col}_sub_{make}'].fillna(0)
        df_others = df_merged[df_all.columns]

    df_others['Make'] = 'Other'
    return df_others

# Function to combine all makes into one final DataFrame
def combine_dataframes(dfs):
    combined_df = pd.concat(dfs)
    combined_df = combined_df[['Date', 'Dealership', 'Lead Source', 'Type', 'Make'] + 
                              [col for col in combined_df.columns if col not in ['Date', 'Dealership', 'Lead Source', 'Type', 'Make']]]
    combined_df.sort_values(by=['Lead Source', 'Type', 'Make'], inplace=True)
    combined_df.reset_index(drop=True, inplace=True)
    return combined_df

@app.route('/upload', methods=['POST'])
def upload_file():
    dfs = []

    # Process each uploaded file based on its 'Make'
    for make in request.files:
        file = request.files[make]
        df = read_csv_with_make(io.StringIO(file.stream.read().decode("utf-8")), make)
        dfs.append(df)

    # Combine all dataframes
    combined_df = combine_dataframes(dfs)

    # Additional processing steps can be added here
    # ...

    # Save the combined DataFrame
    combined_df.to_csv('final_combined_output.csv', index=False)

    return "Files processed successfully", 200

if __name__ == '__main__':
    app.run(debug=True)
