declare module '*.pdf';
declare module '*.doc';
declare module '*.docx';

interface Project {
  name: string;
  invoices: File[];
}

interface InvoiceData {
  fileName: string;
  content: string;
}
