import { describe, it, expect } from 'vitest';
import { Server } from 'socket.io';
import {
  assignRoles,
  calculateEstimatedMinutes,
  getOrCreateProfile,
  resolveDayVote,
  resolveNightPhase,
  resolveVotingPhase
} from './game';
import { GameRoom, Player, RoomSettings } from '../shared/types';

function createVotingRoom(players: Player[], votes: Record<string, string>): GameRoom {
  return {
    id: 'TEST',
    name: 'Test Room',
    hostId: players[0]?.id ?? '',
    players,
    phase: 'DAY_VOTING',
    dayCount: 1,
    votes,
    nightActions: { werewolfVotes: {} },
    chatHistory: [],
    winner: null,
    settings: { timerEnabled: true, discussionTime: 60, votingTime: 30, nightTime: 30, selectedRoles: [] },
    timerSecondsRemaining: 30,
    estimatedMinutesTotal: 5,
    estimatedMinutesRemaining: 5
  };
}

describe('Werewolf Game Logic', () => {
  it('should assign roles correctly for 3 players', () => {
    const players: Player[] = [
      { id: '1', socketId: 's1', name: 'A', role: null, isAlive: true },
      { id: '2', socketId: 's2', name: 'B', role: null, isAlive: true },
      { id: '3', socketId: 's3', name: 'C', role: null, isAlive: true }
    ];
    assignRoles(players, ['Seer']);
    const roles = players.map(p => p.role);
    expect(roles.includes('Werewolf')).toBe(true);
    expect(roles.includes('Seer')).toBe(true);
    expect(roles.includes('Villager')).toBe(true);
  });

  it('should assign correct number of werewolves for larger groups', () => {
    const players: Player[] = Array.from({ length: 8 }).map((_, i) => ({
      id: String(i), socketId: `s${i}`, name: `P${i}`, role: null, isAlive: true
    }));
    assignRoles(players, ['Seer', 'Doctor', 'Jester']);
    const werewolves = players.filter(p => p.role === 'Werewolf');
    expect(werewolves.length).toBe(2);
  });

  it('does not assign special roles unless the host selected them', () => {
    const players: Player[] = Array.from({ length: 8 }).map((_, i) => ({
      id: String(i), socketId: `s${i}`, name: `P${i}`, role: null, isAlive: true
    }));

    expect(assignRoles(players, [])).toBe(true);
    expect(players.every(player => player.role === 'Werewolf' || player.role === 'Villager')).toBe(true);
  });

  it('always assigns the selected roles without changing the player count', () => {
    const players: Player[] = Array.from({ length: 5 }).map((_, i) => ({
      id: String(i), socketId: `s${i}`, name: `P${i}`, role: null, isAlive: true
    }));
    const assigned = assignRoles(players, ['Seer', 'Doctor', 'Jester']);

    expect(assigned).toBe(true);
    expect(players.filter(player => player.role === 'Jester')).toHaveLength(1);
    expect(players.filter(player => player.role === 'Seer')).toHaveLength(1);
    expect(players.filter(player => player.role === 'Doctor')).toHaveLength(1);
    expect(players).toHaveLength(5);
  });

  it('rejects selected roles when there are not enough player slots', () => {
    const players: Player[] = Array.from({ length: 3 }).map((_, i) => ({
      id: String(i), socketId: `s${i}`, name: `P${i}`, role: null, isAlive: true
    }));

    expect(assignRoles(players, ['Seer', 'Doctor', 'Jester'])).toBe(false);
    expect(players.every(player => player.role === null)).toBe(true);
  });

  it('awards Jester only when the Jester is actually executed by the day vote', () => {
    const players: Player[] = [
      { id: 'jester', socketId: 'sj', name: 'Jester', role: 'Jester', isAlive: true },
      { id: 'wolf', socketId: 'sw', name: 'Wolf', role: 'Werewolf', isAlive: true },
      { id: 'villager-1', socketId: 's1', name: 'Villager 1', role: 'Villager', isAlive: true },
      { id: 'villager-2', socketId: 's2', name: 'Villager 2', role: 'Villager', isAlive: true }
    ];
    const room = createVotingRoom(players, {
      wolf: 'jester',
      'villager-1': 'jester',
      'villager-2': 'wolf'
    });

    const executed = resolveDayVote(room);

    expect(executed?.role).toBe('Jester');
    expect(room.lastEliminated).toMatchObject({ name: 'Jester', role: 'Jester', phase: 'DAY' });
    expect(room.phase).toBe('ENDED');
    expect(room.winner).toBe('Jester');
    expect(resolveDayVote(room)).toBeNull();
  });

  it('ends the game and updates Jester statistics exactly once after a day execution', () => {
    const players: Player[] = [
      { id: 'jester-winner', socketId: 'sj', name: 'Jester', role: 'Jester', isAlive: true },
      { id: 'wolf', socketId: 'sw', name: 'Wolf', role: 'Werewolf', isAlive: true },
      { id: 'villager-1', socketId: 's1', name: 'Villager 1', role: 'Villager', isAlive: true },
      { id: 'villager-2', socketId: 's2', name: 'Villager 2', role: 'Villager', isAlive: true }
    ];
    const room = createVotingRoom(players, {
      wolf: 'jester-winner',
      'villager-1': 'jester-winner',
      'villager-2': 'wolf'
    });
    const io = new Server();

    resolveVotingPhase(io, room);
    resolveVotingPhase(io, room);

    expect(room.phase).toBe('ENDED');
    expect(room.winner).toBe('Jester');
    expect(getOrCreateProfile('jester-winner', 'Jester')).toMatchObject({
      totalMatches: 1,
      totalWins: 1,
      roleStats: { Jester: { wins: 1, losses: 0 } },
      matchHistory: [{ role: 'Jester', won: true, survived: false, daysLasted: 1 }]
    });
  });

  it('does not award Jester for a night attack', () => {
    const players: Player[] = [
      { id: 'jester-night', socketId: 'sj', name: 'Jester', role: 'Jester', isAlive: true },
      { id: 'wolf', socketId: 'sw', name: 'Wolf', role: 'Werewolf', isAlive: true },
      { id: 'villager-1', socketId: 's1', name: 'Villager 1', role: 'Villager', isAlive: true },
      { id: 'villager-2', socketId: 's2', name: 'Villager 2', role: 'Villager', isAlive: true }
    ];
    const room = createVotingRoom(players, {});
    room.phase = 'NIGHT';
    room.nightActions.werewolfTarget = 'jester-night';

    resolveNightPhase(new Server(), room);

    expect(room.players.find(player => player.id === 'jester-night')?.isAlive).toBe(false);
    expect(room.lastEliminated).toMatchObject({ name: 'Jester', phase: 'NIGHT' });
    expect(room.phase).toBe('DAY_DISCUSSION');
    expect(room.winner).toBeNull();
  });

  it('does not award Jester on a tied vote', () => {
    const players: Player[] = [
      { id: 'jester', socketId: 'sj', name: 'Jester', role: 'Jester', isAlive: true },
      { id: 'wolf', socketId: 'sw', name: 'Wolf', role: 'Werewolf', isAlive: true },
      { id: 'villager-1', socketId: 's1', name: 'Villager 1', role: 'Villager', isAlive: true },
      { id: 'villager-2', socketId: 's2', name: 'Villager 2', role: 'Villager', isAlive: true }
    ];
    const room = createVotingRoom(players, {
      wolf: 'jester',
      'villager-1': 'wolf'
    });

    expect(resolveDayVote(room)).toBeNull();
    expect(room.players.find(player => player.id === 'jester')?.isAlive).toBe(true);
    expect(room.phase).toBe('DAY_VOTING');
    expect(room.winner).toBeNull();
  });

  it('does not allow votes from dead players or votes targeting dead players to execute Jester', () => {
    const players: Player[] = [
      { id: 'jester', socketId: 'sj', name: 'Jester', role: 'Jester', isAlive: true },
      { id: 'wolf', socketId: 'sw', name: 'Wolf', role: 'Werewolf', isAlive: true },
      { id: 'dead', socketId: 'sd', name: 'Dead', role: 'Villager', isAlive: false },
      { id: 'villager', socketId: 'sv', name: 'Villager', role: 'Villager', isAlive: true }
    ];
    const room = createVotingRoom(players, {
      wolf: 'jester',
      dead: 'jester',
      villager: 'wolf'
    });

    expect(resolveDayVote(room)).toBeNull();
    expect(room.winner).toBeNull();
    expect(room.players.find(player => player.id === 'jester')?.isAlive).toBe(true);
  });

  it('does not give a Jester a win when a different player is executed', () => {
    const players: Player[] = [
      { id: 'jester', socketId: 'sj', name: 'Jester', role: 'Jester', isAlive: true },
      { id: 'wolf', socketId: 'sw', name: 'Wolf', role: 'Werewolf', isAlive: true },
      { id: 'villager-1', socketId: 's1', name: 'Villager 1', role: 'Villager', isAlive: true },
      { id: 'villager-2', socketId: 's2', name: 'Villager 2', role: 'Villager', isAlive: true }
    ];
    const room = createVotingRoom(players, {
      wolf: 'villager-1',
      'villager-1': 'villager-1',
      'villager-2': 'jester'
    });

    expect(resolveDayVote(room)?.id).toBe('villager-1');
    expect(room.winner).toBeNull();
    expect(room.phase).toBe('DAY_VOTING');
    expect(room.players.find(player => player.id === 'jester')?.isAlive).toBe(true);
  });

  it('keeps Jester on the existing faction win rules when a faction wins', () => {
    const players: Player[] = [
      { id: 'wolf-1', socketId: 'sw1', name: 'Wolf 1', role: 'Werewolf', isAlive: true },
      { id: 'wolf-2', socketId: 'sw2', name: 'Wolf 2', role: 'Werewolf', isAlive: true },
      { id: 'jester-faction', socketId: 'sj', name: 'Jester', role: 'Jester', isAlive: true },
      { id: 'villager', socketId: 'sv', name: 'Villager', role: 'Villager', isAlive: true }
    ];
    const room = createVotingRoom(players, {});

    resolveVotingPhase(new Server(), room);

    expect(room.phase).toBe('ENDED');
    expect(room.winner).toBe('Werewolves');
    expect(getOrCreateProfile('jester-faction', 'Jester').roleStats.Jester).toEqual({ wins: 0, losses: 1 });
  });

  it('should calculate estimated game duration accurately based on custom settings', () => {
    const settings: RoomSettings = {
      timerEnabled: true,
      discussionTime: 60,
      votingTime: 30,
      nightTime: 30,
      selectedRoles: []
    };
    // 6 players -> ~3 cycles * 120s = 360s = 6 minutes
    const est = calculateEstimatedMinutes(6, settings, 0);
    expect(est.total).toBe(6);
    expect(est.remaining).toBe(6);

    // After 1 day elapsed
    const estDay1 = calculateEstimatedMinutes(6, settings, 1);
    expect(estDay1.remaining).toBe(4);

    // When timer is disabled (untimed mode)
    const untimedSettings: RoomSettings = { ...settings, timerEnabled: false };
    const estUntimed = calculateEstimatedMinutes(6, untimedSettings, 0);
    expect(estUntimed.total).toBe(0);
    expect(estUntimed.remaining).toBe(0);
  });
});
