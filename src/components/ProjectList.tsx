'use client';

import { useState } from 'react';

type Project = {
  name: string;
  invoices: File[];
};

type ProjectListProps = {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  selectedProject: Project | null;
};

export default function ProjectList({ 
  projects, 
  onSelectProject, 
  selectedProject 
}: ProjectListProps) {
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  if (projects.length === 0) {
    return <p className="text-gray-500">暂无上传的项目</p>;
  }

  const toggleExpand = (projectName: string) => {
    setExpandedProject(prev => prev === projectName ? null : projectName);
  };

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <div 
          key={project.name} 
          className={`border rounded-md overflow-hidden ${
            selectedProject?.name === project.name ? 'border-primary' : 'border-gray-200'
          }`}
        >
          <div 
            className={`flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 ${
              selectedProject?.name === project.name ? 'bg-blue-50' : ''
            }`}
            onClick={() => onSelectProject(project)}
          >
            <div>
              <h3 className="font-medium">{project.name}</h3>
              <p className="text-sm text-gray-500">{project.invoices.length} 张发票</p>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(project.name);
                }}
                className="text-gray-500 hover:text-primary"
              >
                {expandedProject === project.name ? '收起' : '查看发票'}
              </button>
            </div>
          </div>
          
          {expandedProject === project.name && (
            <div className="bg-gray-50 p-4 border-t border-gray-200">
              <h4 className="text-sm font-medium mb-2">发票列表：</h4>
              <ul className="text-sm divide-y divide-gray-200">
                {project.invoices.map((invoice, index) => (
                  <li key={index} className="py-2">
                    {invoice.name} ({(invoice.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 