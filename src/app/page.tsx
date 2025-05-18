'use client';

import { useState } from 'react';
import ProjectUploader from '@/components/ProjectUploader';
import ProjectList from '@/components/ProjectList';
import ContractGenerator from '@/components/ContractGenerator';

type Project = {
  name: string;
  invoices: File[];
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleProjectUpload = (newProject: Project) => {
    setProjects((prevProjects) => [...prevProjects, newProject]);
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">上传发票文件夹</h2>
          <ProjectUploader onProjectUpload={handleProjectUpload} />
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">项目列表</h2>
          <ProjectList 
            projects={projects} 
            onSelectProject={handleSelectProject}
            selectedProject={selectedProject}
          />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">合同生成</h2>
        {selectedProject ? (
          <ContractGenerator project={selectedProject} />
        ) : (
          <p className="text-gray-500">请先从左侧选择一个项目</p>
        )}
      </div>
    </div>
  );
}
