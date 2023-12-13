from flask import Flask, request, send_file
import pandas as pd
import io
from tempfile import NamedTemporaryFile

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
    dealership_name = request.form['dealershipName']

    # Process each uploaded file based on its 'Make'
    for key in request.files:
        if key.startswith('file'):
            file_index = key[len('file'):]
            make = request.form.get('make' + file_index, 'Unfiltered')
            file = request.files[key]
            df = read_csv_with_make(io.StringIO(file.stream.read().decode("utf-8")), make)
            df['Dealership'] = dealership_name  # Add the dealership name to each DataFrame
            dfs.append(df)

    # Combine all dataframes
    combined_df = combine_dataframes(dfs)

    # Apply additional processing steps to the combined DataFrame
    combined_df = convert_currency_to_numeric(combined_df, ['Total Front Gross', 'Total Back Gross', 'Total Gross'])
    combined_df = round_small_to_zero(combined_df, ['Total Front Gross', 'Total Back Gross', 'Total Gross'])

    # Calculate 'Other' make values
    specifics = {df['Make'].iloc[0]: df for df in dfs if df['Make'].iloc[0] != 'Unfiltered'}
    df_others = calculate_others(combined_df, specifics)
    combined_df = pd.concat([combined_df, df_others])

    # Save the combined DataFrame to a temporary file
    temp_file = NamedTemporaryFile(mode='w+', delete=False, suffix='.csv', encoding='utf-8')
    combined_df.to_csv(temp_file.name, index=False)
    temp_file.close()

    # Send the file back to the client
    return send_file(temp_file.name, as_attachment=True, attachment_filename=f'{dealership_name}_processed_output.csv')

if __name__ == '__main__':
    app.run(debug=True)
