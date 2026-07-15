import { useState } from 'react';
import { PublicMap } from './components/PublicMap';
import { WelcomeLegend } from './components/WelcomeLegend';
import { hasSeenWelcome, markWelcomeSeen } from './services/places';

export function PublicApp() {
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());

  const handleWelcomeContinue = () => {
    markWelcomeSeen();
    setShowWelcome(false);
  };

  if (showWelcome) {
    return (
      <div className="app-shell public-app-shell">
        <WelcomeLegend onContinue={handleWelcomeContinue} />
      </div>
    );
  }

  return (
    <div className="app-shell public-app-shell">
      <PublicMap />
    </div>
  );
}
