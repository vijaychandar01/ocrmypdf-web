'use client';

import FileUploadForm from './components/form';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-r from-indigo-100 via-pink-100 to-white flex flex-col items-center justify-center space-y-6">
      <h1 className="text-3xl font-bold text-gray-700">Samyak Tech Labs OCR</h1>
      <div className="w-full max-w-xl p-6 bg-white shadow-xl rounded-lg">
        <FileUploadForm />
      </div>
    </main>
  );
}
