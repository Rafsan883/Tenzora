import Navbar from "../layout/Navbar";
import Footer from "../layout/Footer";
import AccountSidebar from "./AccountSidebar";

export default function AccountShell({ children, footer = false, contentClassName = "", sidebarProps = {} }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans text-white selection:bg-cyan-400/20">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1418px] flex-col gap-5 px-4 pb-16 pt-[148px] lg:flex-row lg:items-start lg:gap-7 lg:px-0">
        <AccountSidebar {...sidebarProps} />
        <section className={`min-w-0 flex-1 ${contentClassName}`}>{children}</section>
      </main>
      {footer && <Footer />}
    </div>
  );
}
