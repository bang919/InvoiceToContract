import InvoiceToContract from '@/components/InvoiceToContract';
import TemplateGuide from '@/components/TemplateGuide';

export default function InvoiceToContractPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center mb-2">发票转合同系统</h1>
          <p className="text-center text-gray-600">上传发票PDF，自动生成合同文档</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <InvoiceToContract />
          </div>
          <div>
            <TemplateGuide />
          </div>
        </div>
      </div>
    </main>
  );
} 