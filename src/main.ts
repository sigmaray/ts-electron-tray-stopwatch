import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, screen } from 'electron';
import * as path from 'path';
import { createCanvas } from 'canvas';

// Расширяем тип app для свойства isQuitting
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

let stopwatchState: { elapsedSeconds: number; isRunning: boolean; isPaused: boolean } = {
  elapsedSeconds: 0,
  isRunning: false,
  isPaused: false
};

// Переменные для секундомера в main процессе
let stopwatchInterval: NodeJS.Timeout | null = null;
let startTime: number = 0; // Время когда секундомер был запущен
let pausedElapsed: number = 0; // Накопленное время до паузы

function updateTrayMenu(): void {
  if (!tray) return;
  const isVisible = mainWindow?.isVisible() ?? false;
  const toggleLabel = isVisible ? 'Свернуть в трей' : 'Показать';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: toggleLabel,
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
        updateTrayMenu();
      },
    },
    {
      label: 'Выход',
      click: async () => {
        const result = await dialog.showMessageBox(mainWindow || null as any, {
          type: 'question',
          buttons: ['Отмена', 'Закрыть'],
          defaultId: 0,
          cancelId: 0,
          title: 'Подтверждение',
          message: 'Вы уверены, что хотите закрыть приложение?'
        });

        if (result.response === 1) {
          app.isQuitting = true;
          app.quit();
        }
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createTextIcon(text: string): Electron.NativeImage {
  const size = 22; // Стандартный размер для трея
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Всегда используем зеленый фон
  const bgColor = '#10b981';
  const textColor = '#FFFFFF';
  
  // Рисуем фон
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  
  // Рисуем текст
  ctx.fillStyle = textColor;
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);
  
  // Конвертируем canvas в buffer
  const buffer = canvas.toBuffer('image/png');
  return nativeImage.createFromBuffer(buffer);
}

function formatTimeForTray(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  
  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return `${mins}m`;
  }
  
  // Для больших значений показываем в часах с одной десятичной цифрой
  const hours = seconds / 3600;
  return `${hours.toFixed(1)}h`;
}

function updateTrayIcon(): void {
  if (!tray) return;
  
  let icon: Electron.NativeImage;
  let tooltipText: string;
  
  if (stopwatchState.isPaused && stopwatchState.elapsedSeconds > 0) {
    // Секундомер на паузе - показываем "p"
    icon = createTextIcon('p');
    tooltipText = `Секундомер на паузе: ${formatTimeForTray(stopwatchState.elapsedSeconds)}`;
  } else if (stopwatchState.isRunning && stopwatchState.elapsedSeconds >= 0) {
    // Показываем прошедшие секунды
    const text = formatTimeForTray(stopwatchState.elapsedSeconds);
    icon = createTextIcon(text);
    tooltipText = `Секундомер: ${formatTimeForTray(stopwatchState.elapsedSeconds)}`;
  } else {
    // Прочерк когда секундомер не запущен
    icon = createTextIcon('—');
    tooltipText = 'Секундомер не запущен';
  }
  
  tray.setImage(icon);
  tray.setToolTip(tooltipText);
}

function sendStopwatchUpdateToRenderer(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stopwatch-update', {
      elapsedSeconds: stopwatchState.elapsedSeconds,
      isRunning: stopwatchState.isRunning,
      isPaused: stopwatchState.isPaused
    });
  }
  
  updateTrayIcon();
}

function startStopwatch(): void {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
  }
  
  if (stopwatchState.isPaused) {
    // Возобновляем с места паузы
    startTime = Date.now() - (stopwatchState.elapsedSeconds * 1000);
  } else {
    // Запускаем заново
    stopwatchState.elapsedSeconds = 0;
    startTime = Date.now();
    pausedElapsed = 0;
  }
  
  stopwatchState.isRunning = true;
  stopwatchState.isPaused = false;
  
  stopwatchInterval = setInterval(() => {
    const currentTime = Date.now();
    stopwatchState.elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
    sendStopwatchUpdateToRenderer();
  }, 100); // Обновляем каждые 100мс для точности
  
  sendStopwatchUpdateToRenderer();
}

function pauseStopwatch(): void {
  if (!stopwatchInterval || !stopwatchState.isRunning) return;
  
  clearInterval(stopwatchInterval);
  stopwatchInterval = null;
  
  stopwatchState.isRunning = false;
  stopwatchState.isPaused = true;
  
  sendStopwatchUpdateToRenderer();
}

function stopStopwatch(): void {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  }
  
  stopwatchState.elapsedSeconds = 0;
  stopwatchState.isRunning = false;
  stopwatchState.isPaused = false;
  startTime = 0;
  pausedElapsed = 0;
  
  sendStopwatchUpdateToRenderer();
}

function createAppIcon(): Electron.NativeImage {
  const size = 256; // Большой размер для иконки приложения
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Градиентный фон (зеленый для секундомера)
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#10b981');
  gradient.addColorStop(1, '#059669');
  
  // Рисуем закругленный прямоугольник
  const radius = size * 0.15;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
  
  // Рисуем иконку секундомера (круг с точкой в центре)
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = size * 0.03;
  
  // Внешний круг
  const centerX = size / 2;
  const centerY = size / 2;
  const circleRadius = size * 0.3;
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Центральная точка
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.05, 0, 2 * Math.PI);
  ctx.fill();
  
  // Конвертируем canvas в buffer
  const buffer = canvas.toBuffer('image/png');
  return nativeImage.createFromBuffer(buffer);
}

function createWindow(): void {
  const appIcon = createAppIcon();
  
  // Получаем основной монитор
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const { x, y } = primaryDisplay.workArea;
  
  // Вычисляем позицию для центрирования окна на основном мониторе
  const windowWidth = 600;
  const windowHeight = 500;
  const windowX = x + Math.floor((width - windowWidth) / 2);
  const windowY = y + Math.floor((height - windowHeight) / 2);
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    icon: appIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Обработка закрытия окна - сворачиваем в tray вместо закрытия
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('minimize', () => {
    mainWindow?.hide();
  });

  mainWindow.on('show', updateTrayMenu);
  mainWindow.on('hide', updateTrayMenu);
}

function createTray(): void {
  // Начальная иконка с прочерком
  tray = new Tray(createTextIcon('—'));

  updateTrayMenu();
  updateTrayIcon();

  // ЛКМ по иконке: показать/скрыть окно
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
    updateTrayMenu();
  });

  // Двойной клик по иконке также показывает окно
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
    updateTrayMenu();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Обработчики команд секундомера от renderer
  ipcMain.on('stopwatch-start', () => {
    startStopwatch();
  });

  ipcMain.on('stopwatch-stop', () => {
    stopStopwatch();
  });

  ipcMain.on('stopwatch-pause', () => {
    pauseStopwatch();
  });

  // Обработчик сворачивания окна в трей
  ipcMain.on('minimize-window', () => {
    if (mainWindow) {
      mainWindow.hide();
      updateTrayMenu();
    }
  });

  // Обработчик закрытия приложения
  ipcMain.on('close-app', () => {
    app.isQuitting = true;
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

app.on('window-all-closed', () => {
  // Не закрываем приложение при закрытии всех окон
  // Оно будет работать в tray
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

