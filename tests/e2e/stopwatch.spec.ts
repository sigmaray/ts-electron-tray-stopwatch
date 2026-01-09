import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

test.describe('Stopwatch Application', () => {
  let electronApp: any;
  let window: any;

  test.beforeAll(async () => {
    // Запускаем реальное Electron приложение
    const electronPath = require('electron');
    const mainPath = path.join(__dirname, '../../dist/main.js');
    
    electronApp = await electron.launch({
      executablePath: electronPath,
      args: [mainPath],
      env: {
        ...process.env,
        ELECTRON_DISABLE_SANDBOX: '1',
      },
    });

    // Получаем первое окно приложения
    window = await electronApp.firstWindow();
    
    // Ждем загрузки приложения
    await window.waitForLoadState('domcontentloaded');
    
    // Ждем появления основных элементов
    await window.waitForSelector('#stopwatchDisplay', { timeout: 10000 });
    
    // Ждем инициализации приложения
    await window.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    // Закрываем Electron приложение после всех тестов
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.beforeEach(async () => {
    // Перед каждым тестом убеждаемся, что окно видимо
    if (window) {
      await window.bringToFront();
      
      // Сбрасываем состояние секундомера, если он запущен
      const stopBtn = window.locator('#stopBtn');
      const isStopEnabled = await stopBtn.isEnabled().catch(() => false);
      if (isStopEnabled) {
        await stopBtn.click();
        await window.waitForTimeout(300);
      }
    }
  });

  test('должен отображать начальное состояние', async () => {
    // Проверяем, что секундомер показывает 00:00.00
    await expect(window.locator('#stopwatchDisplay')).toHaveText('00:00.00');
    
    // Проверяем, что кнопка старта активна
    await expect(window.locator('#startBtn')).toBeEnabled();
    
    // Проверяем, что кнопки паузы и остановки неактивны
    await expect(window.locator('#pauseBtn')).toBeDisabled();
    await expect(window.locator('#stopBtn')).toBeDisabled();
  });

  test('должен запускать секундомер', async () => {
    // Запускаем секундомер
    await window.click('#startBtn');
    
    // Ждем обновления UI
    await window.waitForTimeout(300);
    
    // Проверяем, что кнопка старта неактивна
    await expect(window.locator('#startBtn')).toBeDisabled();
    
    // Проверяем, что кнопки паузы и остановки активны
    await expect(window.locator('#pauseBtn')).toBeEnabled();
    await expect(window.locator('#stopBtn')).toBeEnabled();
    
    // Проверяем, что секундомер начал отсчет (не 00:00.00)
    await window.waitForTimeout(500);
    const timerText = await window.locator('#stopwatchDisplay').textContent();
    expect(timerText).not.toBe('00:00.00');
    
    // Проверяем формат времени (должен содержать миллисекунды)
    expect(timerText).toMatch(/\d{2}:\d{2}\.\d{2}/);
  });

  test('должен останавливать секундомер', async () => {
    // Запускаем секундомер
    await window.click('#startBtn');
    
    // Ждем обновления UI
    await window.waitForTimeout(500);
    
    // Останавливаем секундомер
    await window.click('#stopBtn');
    
    // Ждем обновления UI
    await window.waitForTimeout(300);
    
    // Проверяем, что секундомер остановлен
    await expect(window.locator('#stopwatchDisplay')).toHaveText('00:00.00');
    
    // Проверяем, что кнопка старта активна
    await expect(window.locator('#startBtn')).toBeEnabled();
    
    // Проверяем, что кнопки паузы и остановки неактивны
    await expect(window.locator('#pauseBtn')).toBeDisabled();
    await expect(window.locator('#stopBtn')).toBeDisabled();
  });

  test('должен ставить секундомер на паузу и возобновлять', async () => {
    // Запускаем секундомер
    await window.click('#startBtn');
    
    // Ждем обновления UI
    await window.waitForTimeout(500);
    
    // Ставим на паузу
    await window.click('#pauseBtn');
    
    // Ждем обновления UI
    await window.waitForTimeout(300);
    
    // Проверяем, что кнопка показывает "Пауза" (она должна быть неактивна)
    await expect(window.locator('#pauseBtn')).toBeDisabled();
    
    // Проверяем, что кнопка старта показывает "Возобновить"
    await expect(window.locator('#startBtn')).toHaveText('Возобновить');
    await expect(window.locator('#startBtn')).toBeEnabled();
    
    // Запоминаем время на паузе
    const pausedTime = await window.locator('#stopwatchDisplay').textContent();
    
    // Ждем немного - время не должно измениться
    await window.waitForTimeout(1000);
    await expect(window.locator('#stopwatchDisplay')).toHaveText(pausedTime!);
    
    // Возобновляем через кнопку Старт
    await window.click('#startBtn');
    
    // Ждем обновления UI
    await window.waitForTimeout(300);
    
    // Проверяем, что кнопка показывает "Старт" и неактивна
    await expect(window.locator('#startBtn')).toHaveText('Старт');
    await expect(window.locator('#startBtn')).toBeDisabled();
    
    // Проверяем, что кнопка паузы активна
    await expect(window.locator('#pauseBtn')).toBeEnabled();
    
    // Ждем немного - время должно измениться
    await window.waitForTimeout(1500);
    const resumedTime = await window.locator('#stopwatchDisplay').textContent();
    expect(resumedTime).not.toBe(pausedTime);
  });

  test('должен показывать статус секундомера', async () => {
    const status = window.locator('#status');
    
    // Проверяем начальный статус
    await expect(status).toContainText('Секундомер остановлен');
    
    // Запускаем секундомер
    await window.click('#startBtn');
    await window.waitForTimeout(300);
    await expect(status).toContainText('Секундомер запущен');
    
    // Ставим на паузу
    await window.click('#pauseBtn');
    await window.waitForTimeout(300);
    await expect(status).toContainText('Секундомер на паузе');
    
    // Останавливаем
    await window.click('#stopBtn');
    await window.waitForTimeout(300);
    await expect(status).toContainText('Секундомер остановлен');
  });

  test('должен отображать время с миллисекундами', async () => {
    // Запускаем секундомер
    await window.click('#startBtn');
    
    // Ждем обновления UI
    await window.waitForTimeout(500);
    
    // Проверяем формат времени (MM:SS.mm)
    const timerText = await window.locator('#stopwatchDisplay').textContent();
    expect(timerText).toMatch(/^\d{2}:\d{2}\.\d{2}$/);
    
    // Ждем еще немного и проверяем, что время изменилось
    await window.waitForTimeout(500);
    const newTimerText = await window.locator('#stopwatchDisplay').textContent();
    expect(newTimerText).not.toBe(timerText);
  });

  test('должен продолжать отсчет при сворачивании окна', async () => {
    // Запускаем секундомер
    await window.click('#startBtn');
    await window.waitForTimeout(500);
    
    // Запоминаем время
    const timeBefore = await window.locator('#stopwatchDisplay').textContent();
    
    // Сворачиваем в трей
    await window.evaluate(() => {
      (window as any).electronAPI.minimizeWindow();
    });
    await window.waitForTimeout(1000);
    
    // Показываем окно обратно
    await electronApp.evaluate(() => {
      const getTray = (global as any).__tray__;
      if (getTray) {
        const tray = getTray();
        if (tray) {
          tray.emit('click');
        }
      }
    });
    await window.waitForTimeout(500);
    
    // Ждем загрузки элементов
    await window.waitForSelector('#stopwatchDisplay', { timeout: 5000 });
    
    // Проверяем, что время изменилось (секундомер продолжал работать)
    const timeAfter = await window.locator('#stopwatchDisplay').textContent();
    expect(timeAfter).not.toBe(timeBefore);
    
    // Останавливаем
    await window.click('#stopBtn');
  });

  test('должен сворачивать окно в трей', async () => {
    // Проверяем, что окно изначально видимо
    const isVisibleBefore = await electronApp.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows.length > 0 && windows[0].isVisible();
    });
    expect(isVisibleBefore).toBe(true);

    // Эмулируем клик по иконке трея для сворачивания окна
    await electronApp.evaluate(() => {
      const getTray = (global as any).__tray__;
      if (getTray) {
        const tray = getTray();
        if (tray) {
          tray.emit('click');
        }
      }
    });

    // Ждем, пока окно скроется
    await window.waitForTimeout(500);

    // Проверяем, что окно скрыто
    const isVisibleAfter = await electronApp.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows.length > 0 && windows[0].isVisible();
    });
    expect(isVisibleAfter).toBe(false);
  });

  test('должен показывать окно из трея', async () => {
    // Сначала сворачиваем окно в трей
    await window.evaluate(() => {
      (window as any).electronAPI.minimizeWindow();
    });
    await window.waitForTimeout(500);

    // Проверяем, что окно скрыто
    const isVisibleBefore = await electronApp.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows.length > 0 && windows[0].isVisible();
    });
    expect(isVisibleBefore).toBe(false);

    // Эмулируем клик по иконке трея
    await electronApp.evaluate(() => {
      const getTray = (global as any).__tray__;
      if (getTray) {
        const tray = getTray();
        if (tray) {
          tray.emit('click');
        }
      }
    });

    // Ждем, пока окно появится
    await window.waitForTimeout(500);

    // Проверяем, что окно снова видимо
    const isVisibleAfter = await electronApp.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows.length > 0 && windows[0].isVisible();
    });
    expect(isVisibleAfter).toBe(true);

    // Убеждаемся, что элементы интерфейса доступны
    await window.waitForSelector('#stopwatchDisplay', { timeout: 5000 });
  });

  test('должен сохранять состояние при сворачивании и разворачивании', async () => {
    // Запускаем секундомер
    await window.click('#startBtn');
    await window.waitForTimeout(500);

    // Запоминаем состояние секундомера
    const timerTextBefore = await window.locator('#stopwatchDisplay').textContent();
    const isRunningBefore = await window.locator('#startBtn').isDisabled();

    // Сворачиваем в трей
    await electronApp.evaluate(() => {
      const getTray = (global as any).__tray__;
      if (getTray) {
        const tray = getTray();
        if (tray) {
          tray.emit('click');
        }
      }
    });
    await window.waitForTimeout(1000);

    // Показываем окно обратно
    await electronApp.evaluate(() => {
      const getTray = (global as any).__tray__;
      if (getTray) {
        const tray = getTray();
        if (tray) {
          tray.emit('click');
        }
      }
    });
    await window.waitForTimeout(500);

    // Ждем загрузки элементов
    await window.waitForSelector('#stopwatchDisplay', { timeout: 5000 });

    // Проверяем, что секундомер продолжает работать
    const timerTextAfter = await window.locator('#stopwatchDisplay').textContent();
    const isRunningAfter = await window.locator('#startBtn').isDisabled();

    // Секундомер должен продолжать работать (время должно измениться)
    expect(isRunningAfter).toBe(true);
    expect(timerTextAfter).not.toBe(timerTextBefore);

    // Останавливаем секундомер
    await window.click('#stopBtn');
  });

  test('должен правильно обрабатывать паузу и возобновление через кнопку Старт', async () => {
    // Запускаем секундомер
    await window.click('#startBtn');
    await window.waitForTimeout(500);
    
    // Ставим на паузу
    await window.click('#pauseBtn');
    await window.waitForTimeout(300);
    
    // Запоминаем время на паузе
    const pausedTime = await window.locator('#stopwatchDisplay').textContent();
    
    // Возобновляем через кнопку Старт (которая должна показывать "Возобновить")
    await window.click('#startBtn');
    await window.waitForTimeout(500);
    
    // Проверяем, что время продолжило отсчет с того же места
    const resumedTime = await window.locator('#stopwatchDisplay').textContent();
    // Время должно быть больше, чем на паузе
    expect(resumedTime).not.toBe(pausedTime);
    
    // Останавливаем
    await window.click('#stopBtn');
  });
});

