const headerStyle = {
  backgroundColor: '#1e293b',
  color: '#f1f5f9',
  padding: '2rem 1rem',
  borderRadius: '0.75rem',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
};

const headingStyle = {
  color: '#38bdf8',
};

const subtitleStyle = {
  color: '#cbd5e1',
};

function Header() {
  return (
    <header style={headerStyle}>
      <h1 style={headingStyle}>welcome to Javascript Course</h1>
      <p style={subtitleStyle}>Learn from basics and become expert in very short time</p>
    </header>
  );
}
export default Header; 