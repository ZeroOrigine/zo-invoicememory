import { InvoiceForm } from '@/components/invoices/invoice-form';

export default function NewInvoicePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Invoice</h1>
        <p className="text-gray-600 mt-2">Fill out the details below to create a new invoice.</p>
      </div>
      
      <InvoiceForm />
    </div>
  );
}