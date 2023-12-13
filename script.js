document.addEventListener('DOMContentLoaded', function() {
    addFileUpload(); // Add initial file upload section
});

function addFileUpload() {
    const uploadContainer = document.getElementById('fileUploadContainer');
    
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-upload';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    
    const makeSelection = document.createElement('select');
    const makes = ['Acura', 'Audi', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ford', 'GMC', 'Honda', 'Hyundai', 'Jeep', 'Nissan', 'Ram', 'Volvo', 'Subaru', 'Porsche'];
    makes.forEach(make => {
        const option = document.createElement('option');
        option.value = make;
        option.text = make;
        makeSelection.appendChild(option);
    });

    fileDiv.appendChild(fileInput);
    fileDiv.appendChild(makeSelection);
    uploadContainer.appendChild(fileDiv);
}

async function uploadFiles() {
    const dealershipName = document.getElementById('dealershipName').value;
    const formData = new FormData();
    formData.append('dealershipName', dealershipName);

    const fileUploads = document.querySelectorAll('.file-upload');
    fileUploads.forEach((div, index) => {
        const file = div.querySelector('input[type="file"]').files[0];
        const make = div.querySelector('select').value;
        formData.append('file' + index, file);
        formData.append('make' + index, make);
    });

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            alert("Files uploaded successfully.");
        } else {
            alert("Upload failed.");
        }
    } catch (error) {
        console.error('Error:', error);
    }
}
