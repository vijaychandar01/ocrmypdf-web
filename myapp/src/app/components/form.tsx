import React, { useState, useCallback } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { useDropzone, FileRejection } from 'react-dropzone';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const languages = [
  { value: 'eng', label: 'English' },
  { value: 'hin', label: 'Hindi' },
  { value: 'guj', label: 'Gujarati' },
  { value: 'fra', label: 'French' },
  // Add other languages as needed
];

const FileUploadForm: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<{ value: string; label: string }[]>([{ value: 'eng', label: 'English' }]);
  const [progress, setProgress] = useState<number>(0);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      fileRejections.forEach(({ file, errors }) => {
        errors.forEach(err => {
          if (err.code === 'file-too-large') {
            toast.error('File is too large. Max size is 30 MB.');
          }
        });
      });
    } else {
      setSelectedFile(acceptedFiles[0]);
      setDownloadLink(null); // Reset download link when a new file is selected
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [] },
    maxFiles: 1,
    maxSize: 30 * 1024 * 1024, // 30 MB limit
    disabled: isProcessing, // Disable dropzone during processing
  });

  const handleLanguageChange = (selectedOptions: any) => {
    if (selectedOptions.length > 3) {
      toast.warning('You can select a maximum of three languages.');
      return;
    }
    if (selectedOptions.length === 0) {
      toast.warning('At least one language must be selected.');
      return;
    }
    setSelectedLanguages(selectedOptions);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      toast.error('Please select a file.');
      return;
    }

    if (selectedLanguages.length === 0) {
      toast.error('Please select at least one language.');
      return;
    }

    try {
      setIsProcessing(true); // Set processing state to true
      setStatus('Uploading file...');
      setProgress(0);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('languages', selectedLanguages.map(lang => lang.value).join('+'));

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          if (total) {
            setProgress(Math.floor((loaded / total) * 100));
          }
        },
      });

      setStatus('Upload complete. Processing OCR...');
      await pollForOCRCompletion(response.data.fileId);
    } catch (error) {
      console.error('Error uploading file:', error);
      setStatus('Error during file upload or OCR processing.');
      setIsProcessing(false); // Reset processing state
    }
  };

  const pollForOCRCompletion = async (fileId: string) => {
    let completed = false;
    while (!completed) {
      try {
        const { data } = await axios.get(`/api/check-status?fileId=${fileId}`);
        setProgress(Math.floor(data.progress)); // Ensure progress is an integer
        if (data.status === 'complete') {
          completed = true;
          setStatus('OCR processing complete.');
          setDownloadLink(data.outputFilePath);
        } else if (data.status === 'error') {
          completed = true;
          setStatus('OCR processing failed.');
        } else {
          setStatus(`OCR processing... ${Math.floor(data.progress)}% complete`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        }
      } catch (error) {
        console.error('Error polling OCR status:', error);
        setStatus('Error while checking OCR status.');
        completed = true;
      }
    }
    setIsProcessing(false); // Reset processing state when done
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      <ToastContainer />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed border-gray-300 p-6 rounded-lg cursor-pointer bg-gray-100 hover:bg-gray-200 transition ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} disabled={isProcessing} />
          {selectedFile ? (
            <p className="text-gray-700">{selectedFile.name}</p>
          ) : (
            <p className="text-gray-500">Drag & drop a PDF file here, or click to select a file</p>
          )}
        </div>

        <Select
          isMulti
          options={languages}
          value={selectedLanguages}
          onChange={handleLanguageChange}
          placeholder="Select up to 3 languages"
          className="text-gray-700"
          isDisabled={isProcessing} // Disable language selection during processing
        />
        <p className="text-gray-500 text-sm">
          Note: Selecting more languages than required may slow down the processing time.
        </p>

        <button
          type="submit"
          className={`w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isProcessing} // Disable submit button during processing
        >
          Upload
        </button>
      </form>

      {progress > 0 && (
        <div className="mt-4">
          <div className="text-center">Progress: {progress}%</div>
          {/* Optional: Add a progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {status && (
        <div className="mt-2 text-center text-gray-700">
          {status}
        </div>
      )}

      {downloadLink && (
        <div className="mt-4 text-center">
          <a
            href={downloadLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Download Processed File
          </a>
        </div>
      )}
    </div>
  );  
};

export default FileUploadForm;
