let elapsedSeconds: number = 0;
let elapsedMilliseconds: number = 0;
let isRunning: boolean = false;
let isPaused: boolean = false;

// Типы для electronAPI
interface ElectronAPI {
  minimizeWindow: () => void;
  closeApp: () => void;
  startStopwatch: () => void;
  stopStopwatch: () => void;
  pauseStopwatch: () => void;
  onStopwatchUpdate: (callback: (state: { elapsedSeconds: number; elapsedMilliseconds: number; isRunning: boolean; isPaused: boolean }) => void) => void;
  removeStopwatchUpdateListener: () => void;
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = Math.floor((milliseconds % 1000) / 10); // Показываем сотые доли секунды (00-99)
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function updateDisplay(): void {
  const display = document.getElementById('stopwatchDisplay');
  if (display) {
    display.textContent = formatTime(elapsedMilliseconds);
  }
}

function updateButtons(): void {
  const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
  const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
  const status = document.getElementById('status');
  
  if (startBtn) {
    // Кнопка "Старт" активна когда не запущен или на паузе
    startBtn.disabled = isRunning && !isPaused;
    startBtn.textContent = isPaused ? 'Возобновить' : 'Старт';
  }
  
  if (pauseBtn) {
    // Кнопка "Пауза" активна только когда запущен и не на паузе
    pauseBtn.disabled = !isRunning || isPaused;
    pauseBtn.textContent = 'Пауза';
  }
  
  if (stopBtn) {
    // Кнопка "Стоп" активна когда запущен или на паузе
    stopBtn.disabled = !isRunning && !isPaused;
  }
  
  if (status) {
    if (isPaused) {
      status.textContent = 'Секундомер на паузе';
    } else if (isRunning) {
      status.textContent = 'Секундомер запущен...';
    } else {
      status.textContent = 'Секундомер остановлен';
    }
  }
}

function startStopwatch(): void {
  const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
  if (electronAPI) {
    electronAPI.startStopwatch();
  }
}

function pauseStopwatch(): void {
  const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
  if (electronAPI) {
    electronAPI.pauseStopwatch();
  }
}

function stopStopwatch(): void {
  const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
  if (electronAPI) {
    electronAPI.stopStopwatch();
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  // Подключаем слушатели обновлений от main процесса
  const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
  if (electronAPI) {
    // Слушаем обновления секундомера
    electronAPI.onStopwatchUpdate((state) => {
      elapsedSeconds = state.elapsedSeconds;
      elapsedMilliseconds = state.elapsedMilliseconds;
      isRunning = state.isRunning;
      isPaused = state.isPaused;
      
      updateDisplay();
      updateButtons();
    });
  }

  // Подключаем обработчики кнопок
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const minimizeBtn = document.getElementById('minimizeBtn');
  const closeBtn = document.getElementById('closeBtn');

  if (startBtn) {
    startBtn.addEventListener('click', startStopwatch);
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', pauseStopwatch);
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', stopStopwatch);
  }

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
      if (electronAPI) {
        electronAPI.minimizeWindow();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const confirmed = confirm('Вы уверены, что хотите закрыть приложение?');
      if (confirmed) {
        const electronAPI = (window as any).electronAPI as ElectronAPI | undefined;
        if (electronAPI) {
          electronAPI.closeApp();
        }
      }
    });
  }
  
  // Инициализируем состояние
  updateDisplay();
  updateButtons();
});

