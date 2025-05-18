'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

type ProjectUploaderProps = {
  onProjectUpload: (project: { name: string; invoices: File[] }) => void;
};

export default function ProjectUploader({ onProjectUpload }: ProjectUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedProjectName, setExtractedProjectName] = useState<string>('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // 只接受PDF文件
    const pdfFiles = acceptedFiles.filter(file => 
      file.type === 'application/pdf' || file.name.endsWith('.pdf')
    );
    setFiles(pdfFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    }
  });

  // 从文件名中提取项目名称
  useEffect(() => {
    if (files.length > 0) {
      // 尝试从文件名中提取项目名
      const firstFileName = files[0].name;
      // 假设文件名格式为 "项目名-发票.pdf" 或类似的格式
      // 提取项目部分，可以根据实际文件命名规则调整
      let projectName = firstFileName.split('-')[0].trim();
      
      // 如果没有提取到合适的项目名，使用上传时间作为替代
      if (!projectName || projectName.length < 2) {
        projectName = `项目_${new Date().toISOString().slice(0, 10)}`;
      }
      
      setExtractedProjectName(projectName);
    }
  }, [files]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0) {
      alert('请上传至少一张发票');
      return;
    }

    setIsUploading(true);
    
    // 模拟上传处理
    setTimeout(() => {
      onProjectUpload({
        name: extractedProjectName || `项目_${new Date().toISOString().slice(0, 10)}`,
        invoices: files
      });
      
      // 重置表单
      setFiles([]);
      setExtractedProjectName('');
      setIsUploading(false);
    }, 1000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          上传发票（PDF格式）
        </label>
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed p-6 rounded-md text-center cursor-pointer transition ${
            isDragActive ? 'border-primary bg-blue-50' : 'border-gray-300 hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="text-primary">拖放文件到此处...</p>
          ) : (
            <div>
              <p>拖放发票文件到此处，或点击选择文件</p>
              <p className="text-sm text-gray-500 mt-1">（仅支持PDF格式）</p>
            </div>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700">已选择的文件：</h3>
          <ul className="mt-2 divide-y divide-gray-200 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <li key={index} className="py-2 text-sm">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </li>
            ))}
          </ul>
          {extractedProjectName && (
            <div className="mt-2 text-sm">
              <span className="font-medium">检测到的项目名称：</span> {extractedProjectName}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isUploading || files.length === 0}
        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
          isUploading || files.length === 0
            ? 'opacity-50 cursor-not-allowed'
            : ''
        }`}
      >
        {isUploading ? (
          <div className="flex items-center">
            <div className="spinner mr-2 w-4 h-4"></div>
            <span>处理中...</span>
          </div>
        ) : (
          '上传项目'
        )}
      </button>
    </form>
  );
} 