
import React, { useState } from 'react';
import MailIcon from './icons/MailIcon';
import LockIcon from './icons/LockIcon';
import EyeIcon from './icons/EyeIcon';
import EyeOffIcon from './icons/EyeOffIcon';

const FloatingPieces: React.FC = () => {
    const pieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
    const positions = [
        { left: '10%', duration: '20s', delay: '0s' },
        { left: '20%', duration: '25s', delay: '2s' },
        { left: '80%', duration: '18s', delay: '4s' },
        { left: '90%', duration: '22s', delay: '6s' },
        { left: '70%', duration: '16s', delay: '8s' },
        { left: '30%', duration: '24s', delay: '10s' },
    ];

    return (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
            {pieces.map((piece, index) => (
                <div
                    key={index}
                    className="absolute text-2xl text-white/10 motion-reduce:hidden animate-[float_linear_infinite]"
                    style={{
                        left: positions[index].left,
                        animationDuration: positions[index].duration,
                        animationDelay: positions[index].delay,
                    }}
                >
                    {piece}
                </div>
            ))}
        </div>
    );
};

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] =useState("");
  const [error, setError] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    // Mock API call
    setTimeout(() => {
        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
        } else {
             // On success, you would navigate away
             console.log("Form submitted successfully");
        }
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)' }}></div>
      <FloatingPieces />

      <div className="w-full max-w-md bg-white/95 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700 shadow-2xl p-6 sm:p-8 z-10 animate-[cardSlideIn_0.8s_ease-out]">
        <div className="text-center mb-8">
          <div className="text-5xl inline-block text-yellow-400 animate-[crownGlow_2s_ease-in-out_infinite_alternate] motion-reduce:animate-none">♔</div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mt-2 bg-gradient-to-r from-gray-700 to-gray-900 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
            Chess Master
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isLogin ? 'Welcome back, Grandmaster!' : 'Join the Chess Academy'}</p>
          <div className="mt-4">
            <span className="inline-block bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-full">Level 1</span>
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-1.5 rounded-full w-1/3 animate-[xpPulse_2s_ease-in-out_infinite] motion-reduce:animate-none"></div>
            </div>
          </div>
        </div>

        <div className="bg-gray-100 dark:bg-gray-900/50 flex p-1 rounded-xl mb-6">
          <button onClick={() => setIsLogin(true)} className={`w-1/2 p-2 rounded-lg font-semibold transition-all duration-300 ${isLogin ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300'}`}>Login</button>
          <button onClick={() => setIsLogin(false)} className={`w-1/2 p-2 rounded-lg font-semibold transition-all duration-300 ${!isLogin ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300'}`}>Register</button>
        </div>

        {error && <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-3 rounded-lg mb-4 text-center text-sm font-medium animate-[errorShake_0.5s_ease-out]">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <MailIcon />
            </div>
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} className="w-full pl-10 pr-4 py-3 bg-white/80 dark:bg-gray-900/50 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 dark:text-white" />
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <LockIcon />
            </div>
            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} className="w-full pl-10 pr-12 py-3 bg-white/80 dark:bg-gray-900/50 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 dark:text-white" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 rounded-lg hover:scale-[1.02] active:scale-100 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-purple-500/50 relative overflow-hidden group">
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin mx-auto"></div>
            ) : (
                <>
                    <span className="relative z-10">{isLogin ? 'Enter Game' : 'Join Academy'}</span>
                    <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-500 group-hover:left-[100%] motion-reduce:hidden"></div>
                </>
            )}
          </button>
        </form>

        <div className="flex items-center my-6">
          <hr className="flex-grow border-gray-300 dark:border-gray-600" />
          <span className="mx-4 text-gray-500 dark:text-gray-400 text-sm font-medium">OR</span>
          <hr className="flex-grow border-gray-300 dark:border-gray-600" />
        </div>

        {/* Placeholder for Social Login */}
        <button className="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-300">Continue as Guest</button>
        
        <div className="text-center mt-8">
            <div className="flex justify-center gap-4 mb-4 text-3xl">
                <div className="animate-[achievementGlow_3s_ease-in-out_infinite] motion-reduce:animate-none">🏆</div>
                <div className="animate-[achievementGlow_3s_ease-in-out_infinite_1s] motion-reduce:animate-none">⭐</div>
                <div className="animate-[achievementGlow_3s_ease-in-out_infinite_2s] motion-reduce:animate-none">🎯</div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                By continuing, you agree to our <a href="#" className="text-purple-600 dark:text-purple-400 hover:underline">Terms of Service</a> and <a href="#" className="text-purple-600 dark:text-purple-400 hover:underline">Privacy Policy</a>.
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
