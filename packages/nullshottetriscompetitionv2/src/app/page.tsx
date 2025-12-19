'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Tetromino shapes
const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000'
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 30;

type ShapeType = keyof typeof SHAPES;

export default function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const gameStateRef = useRef({
    board: Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0)),
    currentPiece: null as { shape: number[][], type: ShapeType, x: number, y: number } | null,
    dropCounter: 0,
    dropInterval: 1000,
    lastTime: 0
  });

  const createPiece = useCallback((): { shape: number[][], type: ShapeType, x: number, y: number } => {
    const types = Object.keys(SHAPES) as ShapeType[];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
      shape: SHAPES[type].map(row => [...row]),
      type,
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(SHAPES[type][0].length / 2),
      y: 0
    };
  }, []);

  const drawBlock = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const { board, currentPiece } = gameStateRef.current;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, BOARD_WIDTH * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);

    // Draw board
    board.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          drawBlock(ctx, x, y, value as string);
        }
      });
    });

    // Draw current piece
    if (currentPiece) {
      currentPiece.shape.forEach((row, dy) => {
        row.forEach((value, dx) => {
          if (value) {
            drawBlock(ctx, currentPiece.x + dx, currentPiece.y + dy, COLORS[currentPiece.type]);
          }
        });
      });
    }

    // Draw grid
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= BOARD_WIDTH; i++) {
      ctx.beginPath();
      ctx.moveTo(i * BLOCK_SIZE, 0);
      ctx.lineTo(i * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);
      ctx.stroke();
    }
    for (let i = 0; i <= BOARD_HEIGHT; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * BLOCK_SIZE);
      ctx.lineTo(BOARD_WIDTH * BLOCK_SIZE, i * BLOCK_SIZE);
      ctx.stroke();
    }
  }, [drawBlock]);

  const collide = useCallback((piece: { shape: number[][], x: number, y: number }) => {
    const { board } = gameStateRef.current;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = piece.x + x;
          const newY = piece.y + y;
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || (newY >= 0 && board[newY][newX])) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const merge = useCallback(() => {
    const { board, currentPiece } = gameStateRef.current;
    if (!currentPiece) return;

    currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const boardY = currentPiece.y + y;
          const boardX = currentPiece.x + x;
          if (boardY >= 0) {
            board[boardY][boardX] = COLORS[currentPiece.type];
          }
        }
      });
    });
  }, []);

  const clearLines = useCallback(() => {
    const { board } = gameStateRef.current;
    let linesCleared = 0;

    for (let y = board.length - 1; y >= 0; y--) {
      if (board[y].every(cell => cell !== 0)) {
        board.splice(y, 1);
        board.unshift(Array(BOARD_WIDTH).fill(0));
        linesCleared++;
        y++;
      }
    }

    if (linesCleared > 0) {
      setLines(prev => {
        const newLines = prev + linesCleared;
        setLevel(Math.floor(newLines / 10) + 1);
        return newLines;
      });
      setScore(prev => prev + [0, 100, 300, 500, 800][linesCleared] * level);
    }
  }, [level]);

  const rotate = useCallback((piece: { shape: number[][], type: ShapeType, x: number, y: number }) => {
    if (piece.type === 'O') return piece;

    const rotated = piece.shape[0].map((_, i) =>
      piece.shape.map(row => row[i]).reverse()
    );

    const rotatedPiece = { ...piece, shape: rotated };
    
    // Wall kick
    let offset = 0;
    while (collide(rotatedPiece)) {
      rotatedPiece.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > piece.shape[0].length) {
        return piece;
      }
    }

    return rotatedPiece;
  }, [collide]);

  const move = useCallback((dir: number) => {
    const { currentPiece } = gameStateRef.current;
    if (!currentPiece || isPaused) return;

    const newPiece = { ...currentPiece, x: currentPiece.x + dir };
    if (!collide(newPiece)) {
      gameStateRef.current.currentPiece = newPiece;
    }
  }, [collide, isPaused]);

  const drop = useCallback(() => {
    const { currentPiece } = gameStateRef.current;
    if (!currentPiece || isPaused) return;

    const newPiece = { ...currentPiece, y: currentPiece.y + 1 };
    if (!collide(newPiece)) {
      gameStateRef.current.currentPiece = newPiece;
      setScore(prev => prev + 1);
    } else {
      merge();
      clearLines();
      gameStateRef.current.currentPiece = createPiece();
      
      if (collide(gameStateRef.current.currentPiece)) {
        setGameOver(true);
        setGameStarted(false);
      }
    }
  }, [collide, merge, clearLines, createPiece, isPaused]);

  const hardDrop = useCallback(() => {
    const { currentPiece } = gameStateRef.current;
    if (!currentPiece || isPaused) return;

    let dropDistance = 0;
    while (!collide({ ...currentPiece, y: currentPiece.y + dropDistance + 1 })) {
      dropDistance++;
    }
    
    gameStateRef.current.currentPiece = { ...currentPiece, y: currentPiece.y + dropDistance };
    setScore(prev => prev + dropDistance * 2);
    drop();
  }, [collide, drop, isPaused]);

  const rotatePiece = useCallback(() => {
    const { currentPiece } = gameStateRef.current;
    if (!currentPiece || isPaused) return;
    gameStateRef.current.currentPiece = rotate(currentPiece);
  }, [rotate, isPaused]);

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const update = (time = 0) => {
      const { dropCounter, dropInterval, lastTime } = gameStateRef.current;
      const deltaTime = time - lastTime;
      gameStateRef.current.lastTime = time;
      gameStateRef.current.dropCounter += deltaTime;

      if (gameStateRef.current.dropCounter > dropInterval) {
        drop();
        gameStateRef.current.dropCounter = 0;
      }

      draw(ctx);
      animationId = requestAnimationFrame(update);
    };

    gameStateRef.current.dropInterval = Math.max(100, 1000 - (level - 1) * 100);
    animationId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animationId);
  }, [gameStarted, gameOver, level, drop, draw, isPaused]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted || gameOver || isPaused) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          move(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          move(1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          drop();
          break;
        case 'ArrowUp':
        case ' ':
          e.preventDefault();
          rotatePiece();
          break;
        case 'Enter':
          e.preventDefault();
          hardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver, move, drop, rotatePiece, hardDrop, isPaused]);

  const startGame = () => {
    gameStateRef.current = {
      board: Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0)),
      currentPiece: createPiece(),
      dropCounter: 0,
      dropInterval: 1000,
      lastTime: 0
    };
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameOver(false);
    setGameStarted(true);
    setIsPaused(false);
  };

  const togglePause = () => {
    if (gameStarted && !gameOver) {
      setIsPaused(prev => !prev);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start">
        {/* Game Board */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={BOARD_WIDTH * BLOCK_SIZE}
            height={BOARD_HEIGHT * BLOCK_SIZE}
            className="border-4 border-purple-500 rounded-lg shadow-2xl"
          />
          
          {/* Overlay for game states */}
          {(!gameStarted || gameOver || isPaused) && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
              <div className="text-center text-white p-6">
                {gameOver ? (
                  <>
                    <h2 className="text-4xl font-bold mb-4 text-red-500">Game Over!</h2>
                    <p className="text-2xl mb-2">Score: {score}</p>
                    <p className="text-xl mb-6">Level: {level}</p>
                    <button
                      onClick={startGame}
                      className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold text-lg transition-colors"
                    >
                      Play Again
                    </button>
                  </>
                ) : isPaused ? (
                  <>
                    <h2 className="text-4xl font-bold mb-6">Paused</h2>
                    <button
                      onClick={togglePause}
                      className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition-colors"
                    >
                      Resume
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-4xl font-bold mb-6">Tetris</h2>
                    <button
                      onClick={startGame}
                      className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold text-lg transition-colors"
                    >
                      Start Game
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div className="bg-gray-800/90 rounded-lg p-6 min-w-[200px] border-2 border-purple-500">
            <div className="space-y-4 text-white">
              <div>
                <p className="text-gray-400 text-sm">Score</p>
                <p className="text-3xl font-bold text-purple-400">{score}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Level</p>
                <p className="text-2xl font-bold text-blue-400">{level}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Lines</p>
                <p className="text-2xl font-bold text-green-400">{lines}</p>
              </div>
            </div>
          </div>

          {/* Controls Info */}
          <div className="bg-gray-800/90 rounded-lg p-6 min-w-[200px] border-2 border-purple-500">
            <h3 className="text-white font-bold mb-3">Desktop Controls</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>← → Move</p>
              <p>↑ / Space: Rotate</p>
              <p>↓ Soft Drop</p>
              <p>Enter: Hard Drop</p>
              <p>P: Pause</p>
            </div>
          </div>

          {/* Pause Button */}
          {gameStarted && !gameOver && (
            <button
              onClick={togglePause}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold transition-colors text-white"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Touch Controls */}
      {gameStarted && !gameOver && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center gap-2 lg:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); move(-1); }}
            className="w-16 h-16 bg-purple-600/90 hover:bg-purple-700 rounded-lg font-bold text-white text-2xl active:scale-95 transition-transform"
          >
            ←
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); drop(); }}
            className="w-16 h-16 bg-purple-600/90 hover:bg-purple-700 rounded-lg font-bold text-white text-2xl active:scale-95 transition-transform"
          >
            ↓
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); rotatePiece(); }}
            className="w-16 h-16 bg-blue-600/90 hover:bg-blue-700 rounded-lg font-bold text-white text-2xl active:scale-95 transition-transform"
          >
            ↻
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); move(1); }}
            className="w-16 h-16 bg-purple-600/90 hover:bg-purple-700 rounded-lg font-bold text-white text-2xl active:scale-95 transition-transform"
          >
            →
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); hardDrop(); }}
            className="w-16 h-16 bg-red-600/90 hover:bg-red-700 rounded-lg font-bold text-white active:scale-95 transition-transform"
          >
            ⬇
          </button>
        </div>
      )}
    </div>
  );
}

