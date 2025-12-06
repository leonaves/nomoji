'use client';

import { useEffect, useState } from 'react';
import { AnimatedEmoji } from '@/components/AnimatedEmoji';
import { GuessButtons } from '@/components/GuessButtons';
import { Timer } from '@/components/Timer';
import { ResultsScreen } from '@/components/ResultsScreen';
import { generateSeededGameEmojis } from '@/lib/emoji-generator';

const TOTAL_ROUNDS = 3;

function getDateSeed(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
}

function loadGameData(round: number) {
  const seed = getDateSeed();
  const { allThreeEmojis, displayEmojis, missingEmoji } = generateSeededGameEmojis(seed, round);
  return {
    gameId: `${seed}-${round}`,
    date: seed,
    round,
    totalRounds: TOTAL_ROUNDS,
    emojis: allThreeEmojis,
    displayEmojis,
    missingEmoji,
  };
}

interface GameData {
  gameId: string;
  date: string;
  round: number;
  totalRounds: number;
  emojis: string[];
  displayEmojis: string[];
  missingEmoji: string;
}

interface RoundResult {
  isSuccess: boolean;
  timeMs: number | null;
  correctAnswer: string;
  guesses: string[];
}

export default function Home() {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [timeMs, setTimeMs] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [allRoundsComplete, setAllRoundsComplete] = useState(false);

  // Initialize game on mount
  useEffect(() => {
    console.log('Nomoji: useEffect running, initializing game...');
    const initGame = (round: number): void => {
      console.log('Nomoji: initGame called with round', round);
      const data = loadGameData(round);
      console.log('Nomoji: loadGameData returned', data);
      setGameData(data);
      setCurrentRound(round);

      // Check if all rounds are already completed for today
      const dailyResultsKey = `nomoji_daily_results_${data.date}`;
      const savedResults = localStorage.getItem(dailyResultsKey);

      if (savedResults) {
        try {
          const results: RoundResult[] = JSON.parse(savedResults);
          if (results.length >= data.totalRounds) {
            // All rounds completed - show final results
            setRoundResults(results);
            setAllRoundsComplete(true);
            setGameStarted(true);
            setShowResults(true);
            return;
          } else if (results.length >= round) {
            // This round is already completed, load next incomplete round
            setRoundResults(results);
            initGame(results.length + 1);
            return;
          } else {
            // Some rounds done, continue from where we left off
            setRoundResults(results);
          }
        } catch {
          // Invalid saved data, ignore
        }
      }

      // Check if there's a saved timer for this game (means game was in progress)
      const savedTimer = localStorage.getItem('nomoji_daily_timer');
      if (savedTimer) {
        try {
          const { gameId, elapsedMs } = JSON.parse(savedTimer);
          if (gameId === data.gameId) {
            setStartTime(Date.now() - elapsedMs);
            setGameStarted(true);
            return;
          }
        } catch {
          // Invalid saved data, ignore
        }
      }

      // New game - don't start timer yet, wait for user to click start
      localStorage.removeItem('nomoji_daily_timer');
    };

    initGame(1);
  }, []);

  // Save elapsed time to localStorage every second
  useEffect(() => {
    if (!gameData || showResults || !gameStarted) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      localStorage.setItem('nomoji_daily_timer', JSON.stringify({
        gameId: gameData.gameId,
        elapsedMs: elapsed,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameData, startTime, showResults, gameStarted]);

  const handleStartGame = () => {
    setGameStarted(true);
    setStartTime(Date.now());
  };

  const handleGuess = (emoji: string) => {
    if (!gameData) return;

    const newGuesses = [...guesses, emoji];
    setGuesses(newGuesses);

    const elapsed = Date.now() - startTime;

    const success = emoji === gameData.missingEmoji;

    setCorrectAnswer(gameData.missingEmoji);
    setIsSuccess(success);

    if (success || newGuesses.length >= 2) {
      const finalTimeMs = success ? elapsed : null;
      setTimeMs(finalTimeMs);
      setShowResults(true);

      // Save this round's result
      const roundResult: RoundResult = {
        isSuccess: success,
        timeMs: finalTimeMs,
        correctAnswer: gameData.missingEmoji,
        guesses: newGuesses,
      };

      const newRoundResults = [...roundResults, roundResult];
      setRoundResults(newRoundResults);

      // Save to localStorage
      const dailyResultsKey = `nomoji_daily_results_${gameData.date}`;
      localStorage.setItem(dailyResultsKey, JSON.stringify(newRoundResults));

      // Check if all rounds are complete
      if (newRoundResults.length >= gameData.totalRounds) {
        setAllRoundsComplete(true);
      }

      // Clear the saved timer when round is completed
      localStorage.removeItem('nomoji_daily_timer');
    }
  };

  const handleNextRound = () => {
    if (!gameData || currentRound >= gameData.totalRounds) return;

    setShowResults(false);
    setGuesses([]);
    setIsSuccess(false);
    setCorrectAnswer('');
    setTimeMs(null);

    // Load next round
    const nextRound = currentRound + 1;
    const data = loadGameData(nextRound);
    setGameData(data);
    setCurrentRound(nextRound);
    setStartTime(Date.now());
  };

  if (!gameData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="text-6xl">🎯</div>
          <p className="text-2xl">Loading today&apos;s challenge...</p>
        </div>
      </div>
    );
  }

  // Show explainer/start screen before game begins
  if (!gameStarted) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center space-y-8 p-8 max-w-md">
          <h1 className="text-6xl font-bold">Nomoji</h1>

          <div className="space-y-6 text-left bg-white/10 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <span className="text-3xl">👀</span>
              <p className="text-lg">
                Three emojis are shown below, but only two appear on screen
              </p>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-3xl">🔍</span>
              <p className="text-lg">
                Find which emoji is missing from the floating emojis
              </p>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-3xl">⚡</span>
              <p className="text-lg">
                Be quick! Your time is tracked across all 3 rounds
              </p>
            </div>
          </div>

          <button
            onClick={handleStartGame}
            className="px-12 py-4 bg-white text-black rounded-xl text-2xl font-bold hover:bg-yellow-400 transition-colors"
          >
            Start Game
          </button>

          <a
            href="/infinite"
            className="block text-white/60 hover:text-white underline"
          >
            or try Infinite Mode for practice
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black relative overflow-hidden grid grid-rows-[auto_1fr_auto]">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-b from-black via-black/95 to-transparent p-8 z-10">
        <div className="text-center text-white">
          <h1 className="text-6xl font-bold mb-2">Nomoji</h1>
          <p className="text-2xl text-white/60">
            Round {currentRound} of {gameData.totalRounds}
          </p>
        </div>
      </div>

      {/* Timer */}
      <Timer startTime={startTime} isRunning={!showResults && gameStarted} />

      {/* Animated Emojis Arena */}
      <div className="relative" style={{ marginTop: '180px' }}>
        <div className="absolute inset-0">
          {gameData.displayEmojis.map((emoji, index) => (
            <AnimatedEmoji key={`${gameData.gameId}-${index}`} emoji={emoji} index={index} />
          ))}
        </div>
      </div>

      {/* Guess Buttons */}
      <GuessButtons
        emojis={gameData.emojis}
        onGuess={handleGuess}
        disabled={showResults}
        guessedEmojis={guesses}
      />

      {/* Results */}
      {showResults && (
        <ResultsScreen
          isSuccess={isSuccess}
          timeMs={timeMs}
          correctAnswer={correctAnswer}
          gameType="DAILY"
          currentRound={currentRound}
          totalRounds={gameData.totalRounds}
          roundResults={roundResults}
          allRoundsComplete={allRoundsComplete}
          onNextRound={!allRoundsComplete ? handleNextRound : undefined}
          onClose={allRoundsComplete ? () => setShowResults(false) : undefined}
        />
      )}

      {/* Mode Switch */}
      <a
        href="/infinite"
        className="fixed top-8 right-8 text-white/60 hover:text-white underline z-20"
      >
        Infinite Mode →
      </a>

      {/* See Results Button - shown when all rounds complete but results are closed */}
      {allRoundsComplete && !showResults && (
        <button
          onClick={() => setShowResults(true)}
          className="fixed bottom-8 right-8 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl border-2 border-white/40 hover:border-white transition-all z-20 backdrop-blur-sm"
        >
          See Results
        </button>
      )}
    </main>
  );
}
