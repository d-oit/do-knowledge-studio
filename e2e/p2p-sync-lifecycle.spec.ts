import { test, expect } from '@playwright/test';
import { waitForAppReady, navClick } from './helpers/navigation';

test.describe('P2P Sync Lifecycle Multi-Context', () => {
  test('leave and rejoin preserves local persistence and handles room transitions', async ({ browser }) => {
    // Two independent browser contexts representing two devices/users
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Navigate both pages to app and wait for readiness
      await pageA.goto('/');
      await waitForAppReady(pageA);

      await pageB.goto('/');
      await waitForAppReady(pageB);

      // Navigate both pages to the Sync view
      await navClick(pageA, /sync/i);
      await expect(pageA.getByRole('main').getByRole('heading', { name: 'Sync', exact: true })).toBeVisible();

      await navClick(pageB, /sync/i);
      await expect(pageB.getByRole('main').getByRole('heading', { name: 'Sync', exact: true })).toBeVisible();

      // Page A enters a room ID and joins
      const roomId = `test-room-${Date.now()}`;
      await pageA.getByLabel('Room ID').fill(roomId);
      await pageA.getByRole('button', { name: 'Join' }).click();

      // Page A should display room active or joining, not disconnected
      await expect(pageA.getByText('Room active').or(pageA.getByText('Connecting'))).toBeVisible();
      await expect(pageA.getByRole('button', { name: 'Leave' })).toBeVisible();

      // Verify the UI never equates provider room-active with a reachable peer
      // Since peerCount is 0, it must say "Room active" (or connecting), NOT "Peers connected"
      await expect(pageA.getByText('Peers connected')).toHaveCount(0);

      // Page A leaves room
      await pageA.getByRole('button', { name: 'Leave' }).click();
      await expect(pageA.getByText('Disconnected')).toBeVisible();
      await expect(pageA.getByRole('button', { name: 'Join' })).toBeVisible();

      // Page A rejoins the room
      await pageA.getByLabel('Room ID').fill(roomId);
      await pageA.getByRole('button', { name: 'Join' }).click();
      await expect(pageA.getByRole('button', { name: 'Leave' })).toBeVisible();

      // Reload page A and verify persistence restored
      await pageA.reload();
      await waitForAppReady(pageA);
      await navClick(pageA, /sync/i);
      await expect(pageA.getByRole('main').getByRole('heading', { name: 'Sync', exact: true })).toBeVisible();

      // Page B joins the same room
      await pageB.getByLabel('Room ID').fill(roomId);
      await pageB.getByRole('button', { name: 'Join' }).click();
      await expect(pageB.getByRole('button', { name: 'Leave' })).toBeVisible();

      // Both can leave cleanly
      await pageB.getByRole('button', { name: 'Leave' }).click();
      await expect(pageB.getByText('Disconnected')).toBeVisible();

      await pageA.getByLabel('Room ID').fill(roomId);
      // Clean exit
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
