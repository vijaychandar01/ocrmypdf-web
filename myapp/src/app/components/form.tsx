import React, { useState } from 'react';
import axios from 'axios';
import Select from 'react-select';

const languages = [
  { value: 'eng', label: 'English' },
  { value: 'hin', label: 'Hindi' },
  { value: 'guj', label: 'Gujarati' },
  // Add other languages as needed
];

const FileUploadForm: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<{ value: string; label: string }[]>([{ value: 'eng', label: 'English' }]);
  const [progress, setProgress] = useState<number>(0);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] || null);
  };

  const handleLanguageChange = (selectedOptions: any) => {
    if (selectedOptions.length > 3) {
      alert('You can select a maximum of three languages.');
      return;
    }
    setSelectedLanguages(selectedOptions);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      alert('Please select a file.');
      return;
    }

    if (selectedLanguages.length === 0) {
      alert('Please select at least one language.');
      return;
    }

    try {
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
    }
  };

  const pollForOCRCompletion = async (fileId: string) => {
    let completed = false;
    while (!completed) {
      try {
        const { data } = await axios.get(`/api/check-status?fileId=${fileId}`);
        setProgress(data.progress);
        if (data.status === 'complete') {
          completed = true;
          setStatus('OCR processing complete.');
          setDownloadLink(data.outputFilePath);
        } else if (data.status === 'error') {
          completed = true;
          setStatus('OCR processing failed.');
        } else {
          setStatus(`OCR processing... ${data.progress}% complete`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        }
      } catch (error) {
        console.error('Error polling OCR status:', error);
        setStatus('Error while checking OCR status.');
        completed = true;
      }
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="file" onChange={handleFileChange} accept=".pdf" />
        <Select
          isMulti
          options={languages}
          value={selectedLanguages}
          onChange={handleLanguageChange}
          placeholder="Select up to 3 languages"
        />
        <button type="submit">Upload</button>
      </form>
      {progress > 0 && <div>Progress: {progress}%</div>}
      {status && <div>Status: {status}</div>}
      {downloadLink && <a href={downloadLink} target="_blank" rel="noopener noreferrer">Download Processed File</a>}
    </div>
  );
};

export default FileUploadForm;
