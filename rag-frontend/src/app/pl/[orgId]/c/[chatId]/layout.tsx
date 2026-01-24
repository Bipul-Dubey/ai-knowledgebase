export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-[calc(100vh-90px)] w-full overflow-hidden">
      {children}
    </div>
  );
}
