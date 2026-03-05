import Nav from "./Nav";

interface Props {
  children: React.ReactNode;
  isAdmin?: boolean;
  isLoggedIn?: boolean;
  showNav?: boolean;
}

export default function PageShell({ children, isAdmin, isLoggedIn, showNav = true }: Props) {
  return (
    <>
      {showNav && <Nav isAdmin={isAdmin} isLoggedIn={isLoggedIn} />}
      {children}
    </>
  );
}
