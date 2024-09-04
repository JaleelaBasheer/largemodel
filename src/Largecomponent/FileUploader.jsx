// Update FileUploader.jsx
import React from 'react';
import { storeFile } from '../Largecomponent/indexedDBHelper';
import SceneManager from '../Largecomponent/SceneManager';

function FileUploader({ onFileLoaded }) {
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    for (const file of files) {
      await storeFile(file);
      if (onFileLoaded) {
        onFileLoaded(file.name);
      }
    }
  };

  return (
    <input type="file" multiple onChange={handleFileUpload} />
  );
}

export default FileUploader;
