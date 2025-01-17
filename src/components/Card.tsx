interface CardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function Card({ title, children, action }: CardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
} 