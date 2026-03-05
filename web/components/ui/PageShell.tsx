import Nav from "./Nav";

interface Props {
  children: React.ReactNode;
  isAdmin?: boolean;
  isLoggedIn?: boolean;
  showNav?: boolean;
  title?: string;
}

export default function PageShell({ children, isAdmin, isLoggedIn, showNav = true, title }: Props) {
  return (
    <>
      {showNav && <Nav isAdmin={isAdmin} isLoggedIn={isLoggedIn} title={title} />}
      {children}
    </>
  );
}
