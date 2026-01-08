import { contextBridge, ipcRenderer } from 'electron';

// Предоставляем безопасный API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => {
    ipcRenderer.send('minimize-window');
  },
  closeApp: () => {
    ipcRenderer.send('close-app');
  },
  // Команды секундомера
  startStopwatch: () => {
    ipcRenderer.send('stopwatch-start');
  },
  stopStopwatch: () => {
    ipcRenderer.send('stopwatch-stop');
  },
  pauseStopwatch: () => {
    ipcRenderer.send('stopwatch-pause');
  },
  // Слушатели событий от main процесса
  onStopwatchUpdate: (callback: (state: { elapsedSeconds: number; elapsedMilliseconds: number; isRunning: boolean; isPaused: boolean }) => void) => {
    ipcRenderer.on('stopwatch-update', (_event, state) => callback(state));
  },
  // Удаление слушателей
  removeStopwatchUpdateListener: () => {
    ipcRenderer.removeAllListeners('stopwatch-update');
  }
});

