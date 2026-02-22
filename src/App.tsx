import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Text, Float } from '@react-three/drei'
import * as THREE from 'three'

// Maze layout: 1 = wall, 0 = path, 2 = start, 3 = goal
const MAZE_LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
]

const CELL_SIZE = 2
const WALL_HEIGHT = 3
const PLAYER_RADIUS = 0.3

// Grim reaper jumpscare video URLs (scary clips from the web)
const JUMPSCARE_VIDEO = 'https://www.youtube.com/embed/0c5_7Kk4cNA?autoplay=1&controls=0&showinfo=0&rel=0&loop=1&start=0&end=3'

interface PlayerControllerProps {
  onWallCollision: () => void
  onWin: () => void
  gameActive: boolean
}

function PlayerController({ onWallCollision, onWin, gameActive }: PlayerControllerProps) {
  const { camera } = useThree()
  const playerPos = useRef(new THREE.Vector3(1.5 * CELL_SIZE, 0.5, 1.5 * CELL_SIZE))
  const velocity = useRef(new THREE.Vector2(0, 0))
  const keys = useRef<{ [key: string]: boolean }>({})

  // Find start and goal positions
  const startPos = useRef({ x: 1, z: 1 })
  const goalPos = useRef({ x: 13, z: 13 })

  useEffect(() => {
    for (let z = 0; z < MAZE_LAYOUT.length; z++) {
      for (let x = 0; x < MAZE_LAYOUT[z].length; x++) {
        if (MAZE_LAYOUT[z][x] === 2) {
          startPos.current = { x, z }
          playerPos.current.set((x + 0.5) * CELL_SIZE, 0.5, (z + 0.5) * CELL_SIZE)
        }
        if (MAZE_LAYOUT[z][x] === 3) {
          goalPos.current = { x, z }
        }
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const checkWallCollision = useCallback((x: number, z: number): boolean => {
    const cellX = Math.floor(x / CELL_SIZE)
    const cellZ = Math.floor(z / CELL_SIZE)

    // Check bounds
    if (cellX < 0 || cellX >= MAZE_LAYOUT[0].length || cellZ < 0 || cellZ >= MAZE_LAYOUT.length) {
      return true
    }

    // Check if it's a wall
    if (MAZE_LAYOUT[cellZ][cellX] === 1) {
      return true
    }

    // Check corners for better collision
    const corners = [
      { x: x - PLAYER_RADIUS, z: z - PLAYER_RADIUS },
      { x: x + PLAYER_RADIUS, z: z - PLAYER_RADIUS },
      { x: x - PLAYER_RADIUS, z: z + PLAYER_RADIUS },
      { x: x + PLAYER_RADIUS, z: z + PLAYER_RADIUS },
    ]

    for (const corner of corners) {
      const cx = Math.floor(corner.x / CELL_SIZE)
      const cz = Math.floor(corner.z / CELL_SIZE)
      if (cx >= 0 && cx < MAZE_LAYOUT[0].length && cz >= 0 && cz < MAZE_LAYOUT.length) {
        if (MAZE_LAYOUT[cz][cx] === 1) {
          return true
        }
      }
    }

    return false
  }, [])

  const checkGoal = useCallback((x: number, z: number): boolean => {
    const cellX = Math.floor(x / CELL_SIZE)
    const cellZ = Math.floor(z / CELL_SIZE)
    return cellX === goalPos.current.x && cellZ === goalPos.current.z
  }, [])

  useFrame((_, delta) => {
    if (!gameActive) return

    const speed = 5
    const acceleration = 30
    const friction = 10

    // Get input direction
    let inputX = 0
    let inputZ = 0
    if (keys.current['w'] || keys.current['arrowup']) inputZ -= 1
    if (keys.current['s'] || keys.current['arrowdown']) inputZ += 1
    if (keys.current['a'] || keys.current['arrowleft']) inputX -= 1
    if (keys.current['d'] || keys.current['arrowright']) inputX += 1

    // Normalize input
    const inputLength = Math.sqrt(inputX * inputX + inputZ * inputZ)
    if (inputLength > 0) {
      inputX /= inputLength
      inputZ /= inputLength
    }

    // Apply acceleration
    velocity.current.x += inputX * acceleration * delta
    velocity.current.y += inputZ * acceleration * delta

    // Apply friction
    velocity.current.x -= velocity.current.x * friction * delta
    velocity.current.y -= velocity.current.y * friction * delta

    // Clamp velocity
    const velocityLength = velocity.current.length()
    if (velocityLength > speed) {
      velocity.current.multiplyScalar(speed / velocityLength)
    }

    // Calculate new position
    const newX = playerPos.current.x + velocity.current.x * delta
    const newZ = playerPos.current.z + velocity.current.y * delta

    // Check collision and trigger jumpscare
    if (checkWallCollision(newX, newZ)) {
      onWallCollision()
      velocity.current.set(0, 0)
      return
    }

    // Check goal
    if (checkGoal(newX, newZ)) {
      onWin()
      return
    }

    // Update position
    playerPos.current.x = newX
    playerPos.current.z = newZ

    // Update camera to follow player (top-down view)
    camera.position.set(playerPos.current.x, 15, playerPos.current.z + 5)
    camera.lookAt(playerPos.current.x, 0, playerPos.current.z)
  })

  return (
    <mesh position={[playerPos.current.x, 0.3, playerPos.current.z]}>
      <sphereGeometry args={[PLAYER_RADIUS, 16, 16]} />
      <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      <pointLight color="#ff0000" intensity={2} distance={5} />
    </mesh>
  )
}

function MazeWalls() {
  const walls: JSX.Element[] = []

  for (let z = 0; z < MAZE_LAYOUT.length; z++) {
    for (let x = 0; x < MAZE_LAYOUT[z].length; x++) {
      if (MAZE_LAYOUT[z][x] === 1) {
        walls.push(
          <mesh
            key={`wall-${x}-${z}`}
            position={[(x + 0.5) * CELL_SIZE, WALL_HEIGHT / 2, (z + 0.5) * CELL_SIZE]}
          >
            <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
            <meshStandardMaterial
              color="#1a0a0a"
              roughness={0.9}
              metalness={0.1}
            />
          </mesh>
        )
      }
    }
  }

  return <>{walls}</>
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[MAZE_LAYOUT[0].length * CELL_SIZE / 2, 0, MAZE_LAYOUT.length * CELL_SIZE / 2]}>
      <planeGeometry args={[MAZE_LAYOUT[0].length * CELL_SIZE, MAZE_LAYOUT.length * CELL_SIZE]} />
      <meshStandardMaterial color="#0a0505" roughness={0.95} />
    </mesh>
  )
}

function GoalMarker() {
  let goalX = 13
  let goalZ = 13
  for (let z = 0; z < MAZE_LAYOUT.length; z++) {
    for (let x = 0; x < MAZE_LAYOUT[z].length; x++) {
      if (MAZE_LAYOUT[z][x] === 3) {
        goalX = x
        goalZ = z
      }
    }
  }

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh position={[(goalX + 0.5) * CELL_SIZE, 1, (goalZ + 0.5) * CELL_SIZE]}>
        <octahedronGeometry args={[0.5]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={1} />
        <pointLight color="#00ff00" intensity={3} distance={8} />
      </mesh>
    </Float>
  )
}

function Skulls() {
  const skulls: JSX.Element[] = []
  const positions = [
    [3, 3], [7, 5], [11, 7], [5, 11], [9, 9], [13, 3]
  ]

  positions.forEach(([x, z], i) => {
    if (MAZE_LAYOUT[z] && MAZE_LAYOUT[z][x] !== 1) {
      skulls.push(
        <Float key={`skull-${i}`} speed={1.5} rotationIntensity={0.3} floatIntensity={0.3}>
          <mesh position={[(x + 0.5) * CELL_SIZE, 0.5, (z + 0.5) * CELL_SIZE]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial color="#d4c4a8" emissive="#ff6600" emissiveIntensity={0.2} />
          </mesh>
        </Float>
      )
    }
  })

  return <>{skulls}</>
}

function Scene({ onWallCollision, onWin, gameActive }: PlayerControllerProps) {
  return (
    <>
      <fog attach="fog" args={['#0a0000', 5, 25]} />
      <ambientLight intensity={0.1} />
      <directionalLight position={[10, 20, 10]} intensity={0.3} color="#ff3300" />
      <pointLight position={[15, 10, 15]} intensity={1} color="#ff0000" distance={30} />

      <MazeWalls />
      <Floor />
      <GoalMarker />
      <Skulls />
      <PlayerController onWallCollision={onWallCollision} onWin={onWin} gameActive={gameActive} />

      <Float speed={0.5} rotationIntensity={0.1}>
        <Text
          position={[MAZE_LAYOUT[0].length * CELL_SIZE / 2, WALL_HEIGHT + 2, MAZE_LAYOUT.length * CELL_SIZE / 2]}
          fontSize={1.5}
          color="#ff0000"
          anchorX="center"
          anchorY="middle"
        >
          ESCAPE
        </Text>
      </Float>

      <Environment preset="night" />
    </>
  )
}

function JumpscareOverlay({ onClose }: { onClose: () => void }) {
  const [showVideo, setShowVideo] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVideo(false)
      setTimeout(onClose, 500)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{
        animation: showVideo ? 'shake 0.1s infinite' : 'fadeOut 0.5s forwards',
      }}
    >
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-5px, -5px) rotate(-1deg); }
          20% { transform: translate(5px, -5px) rotate(1deg); }
          30% { transform: translate(-5px, 5px) rotate(0deg); }
          40% { transform: translate(5px, 5px) rotate(1deg); }
          50% { transform: translate(-5px, -5px) rotate(-1deg); }
          60% { transform: translate(5px, -5px) rotate(0deg); }
          70% { transform: translate(-5px, 5px) rotate(-1deg); }
          80% { transform: translate(-5px, -5px) rotate(1deg); }
          90% { transform: translate(5px, 5px) rotate(0deg); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 100px 50px rgba(255, 0, 0, 0.8); }
          50% { box-shadow: 0 0 150px 75px rgba(255, 0, 0, 1); }
        }
      `}</style>

      <div className="relative w-full h-full flex items-center justify-center">
        {/* Scary static image as backup */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, #1a0000 0%, #000 100%)',
            animation: 'pulse-red 0.2s infinite',
          }}
        />

        {/* Grim Reaper Visual */}
        <div className="relative z-10 text-center">
          <div
            className="text-[200px] md:text-[300px] leading-none"
            style={{
              textShadow: '0 0 50px #ff0000, 0 0 100px #ff0000, 0 0 150px #660000',
              animation: 'shake 0.05s infinite',
            }}
          >
            💀
          </div>
          <div
            className="text-4xl md:text-6xl font-bold text-red-600 mt-4"
            style={{
              fontFamily: "'Creepster', cursive",
              textShadow: '0 0 20px #ff0000',
              letterSpacing: '0.2em',
            }}
          >
            YOU DIED
          </div>
        </div>

        {/* Blood drips */}
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bg-red-800"
            style={{
              left: `${10 + i * 9}%`,
              width: '20px',
              height: `${100 + Math.random() * 200}px`,
              borderRadius: '0 0 50% 50%',
              opacity: 0.8,
              animation: `drip ${0.5 + Math.random() * 0.5}s ease-in forwards`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes drip {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}

function WinOverlay({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="text-center p-8">
        <div
          className="text-6xl md:text-8xl mb-8"
          style={{
            fontFamily: "'Creepster', cursive",
            color: '#00ff00',
            textShadow: '0 0 30px #00ff00, 0 0 60px #00ff00',
          }}
        >
          YOU ESCAPED!
        </div>
        <button
          onClick={onRestart}
          className="px-8 py-4 text-xl font-bold text-black bg-green-500 rounded-lg hover:bg-green-400 transition-all transform hover:scale-105"
          style={{
            fontFamily: "'Creepster', cursive",
            boxShadow: '0 0 30px rgba(0, 255, 0, 0.5)',
          }}
        >
          PLAY AGAIN
        </button>
      </div>
    </div>
  )
}

function StartScreen({ onStart }: { onStart: () => void }) {
  const [showWarning, setShowWarning] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #0a0000 0%, #1a0505 50%, #0a0000 100%)',
      }}
    >
      <style>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          41% { opacity: 1; }
          42% { opacity: 0.8; }
          43% { opacity: 1; }
          45% { opacity: 0.3; }
          46% { opacity: 1; }
        }
        @keyframes bloodDrip {
          0% { clip-path: polygon(0 0, 100% 0, 100% 0, 0 0); }
          100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
        }
        @keyframes glow {
          0%, 100% { text-shadow: 0 0 20px #ff0000, 0 0 40px #ff0000, 0 0 60px #660000; }
          50% { text-shadow: 0 0 40px #ff0000, 0 0 80px #ff0000, 0 0 120px #660000; }
        }
      `}</style>

      <div
        className="text-6xl md:text-9xl font-bold mb-8"
        style={{
          fontFamily: "'Creepster', cursive",
          color: '#ff0000',
          animation: 'flicker 3s infinite, glow 2s ease-in-out infinite',
          letterSpacing: '0.1em',
        }}
      >
        THE MAZE
      </div>

      <div
        className="text-xl md:text-2xl text-gray-400 mb-12 text-center px-4 max-w-md"
        style={{
          fontFamily: "'Special Elite', cursive",
        }}
      >
        Navigate through the darkness. Touch a wall and face your doom...
      </div>

      <div className="text-gray-500 mb-8 text-center px-4">
        <p className="mb-2">Use WASD or Arrow Keys to move</p>
        <p>Reach the green crystal to escape</p>
      </div>

      {!showWarning ? (
        <button
          onClick={() => setShowWarning(true)}
          className="px-12 py-5 text-2xl font-bold text-white border-2 border-red-800 rounded-lg hover:bg-red-900/50 transition-all transform hover:scale-105"
          style={{
            fontFamily: "'Creepster', cursive",
            boxShadow: '0 0 30px rgba(255, 0, 0, 0.3)',
          }}
        >
          ENTER IF YOU DARE
        </button>
      ) : (
        <div className="text-center">
          <div className="text-red-500 text-xl mb-6 animate-pulse">
            ⚠️ WARNING: Contains jumpscare ⚠️
          </div>
          <button
            onClick={onStart}
            className="px-12 py-5 text-2xl font-bold text-black bg-red-600 rounded-lg hover:bg-red-500 transition-all transform hover:scale-105"
            style={{
              fontFamily: "'Creepster', cursive",
              boxShadow: '0 0 50px rgba(255, 0, 0, 0.6)',
            }}
          >
            I'M NOT AFRAID
          </button>
        </div>
      )}

      {/* Decorative skulls */}
      <div className="absolute bottom-20 left-0 right-0 flex justify-center space-x-4 opacity-30">
        {['💀', '☠️', '💀', '☠️', '💀'].map((skull, i) => (
          <span
            key={i}
            className="text-4xl"
            style={{
              animation: `float ${2 + i * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            {skull}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}

function MobileControls({ onMove }: { onMove: (dir: string, active: boolean) => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 md:hidden">
      <div className="grid grid-cols-3 gap-2">
        <div />
        <button
          onTouchStart={() => onMove('w', true)}
          onTouchEnd={() => onMove('w', false)}
          className="w-14 h-14 bg-red-900/80 rounded-lg flex items-center justify-center text-2xl border border-red-700"
        >
          ↑
        </button>
        <div />
        <button
          onTouchStart={() => onMove('a', true)}
          onTouchEnd={() => onMove('a', false)}
          className="w-14 h-14 bg-red-900/80 rounded-lg flex items-center justify-center text-2xl border border-red-700"
        >
          ←
        </button>
        <button
          onTouchStart={() => onMove('s', true)}
          onTouchEnd={() => onMove('s', false)}
          className="w-14 h-14 bg-red-900/80 rounded-lg flex items-center justify-center text-2xl border border-red-700"
        >
          ↓
        </button>
        <button
          onTouchStart={() => onMove('d', true)}
          onTouchEnd={() => onMove('d', false)}
          className="w-14 h-14 bg-red-900/80 rounded-lg flex items-center justify-center text-2xl border border-red-700"
        >
          →
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'jumpscare' | 'win'>('start')
  const [key, setKey] = useState(0)

  const handleWallCollision = useCallback(() => {
    setGameState('jumpscare')
  }, [])

  const handleWin = useCallback(() => {
    setGameState('win')
  }, [])

  const handleJumpscareClose = useCallback(() => {
    setKey(k => k + 1)
    setGameState('playing')
  }, [])

  const handleRestart = useCallback(() => {
    setKey(k => k + 1)
    setGameState('playing')
  }, [])

  const handleStart = useCallback(() => {
    setGameState('playing')
  }, [])

  const handleMobileMove = useCallback((dir: string, active: boolean) => {
    const event = new KeyboardEvent(active ? 'keydown' : 'keyup', { key: dir })
    window.dispatchEvent(event)
  }, [])

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      {gameState === 'start' && <StartScreen onStart={handleStart} />}
      {gameState === 'jumpscare' && <JumpscareOverlay onClose={handleJumpscareClose} />}
      {gameState === 'win' && <WinOverlay onRestart={handleRestart} />}

      <div className="w-full h-full">
        <Canvas key={key} camera={{ position: [15, 15, 20], fov: 60 }}>
          <Suspense fallback={null}>
            <Scene
              onWallCollision={handleWallCollision}
              onWin={handleWin}
              gameActive={gameState === 'playing'}
            />
          </Suspense>
        </Canvas>
      </div>

      {gameState === 'playing' && <MobileControls onMove={handleMobileMove} />}

      {/* Footer */}
      <footer
        className="fixed bottom-4 left-0 right-0 text-center text-xs md:text-sm z-30"
        style={{
          fontFamily: "'Special Elite', cursive",
          color: 'rgba(139, 69, 69, 0.6)',
          textShadow: '0 0 10px rgba(139, 0, 0, 0.3)',
        }}
      >
        Requested by @s1s21s21 · Built by @clonkbot
      </footer>
    </div>
  )
}
