import AuthInputs from './components/AuthInputs.jsx';
import Courses from './components/course/Courses.jsx';
import Header from './components/Header.jsx';
import { SessionStatus, useAuth } from './context/AuthContext.jsx';

// The course and the login form are mutually exclusive, and which one you see is
// decided by status — the SERVER's answer, not a boolean this component set for
// itself. Three states, not two: rendering the login form while the session is
// still being checked would flash it at every signed-in user on every page load.
export default function App() {
  const { status } = useAuth();

  return (
    <>
      <Header />

      <main>
        {status === SessionStatus.LOADING ? (
          <div id="auth-inputs" className="auth-message">
            <p>Checking your session…</p>
          </div>
        ) : null}

        {status === SessionStatus.SIGNED_OUT ? <AuthInputs /> : null}

        {status === SessionStatus.SIGNED_IN ? <Courses /> : null}
      </main>
    </>
  );
}