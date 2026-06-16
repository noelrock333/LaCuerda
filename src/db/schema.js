import { pgTable, serial, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

export const songs = pgTable('songs', {
  id: serial('id').primaryKey(),
  artist: text('artist').notNull(),
  title: text('title').notNull(),
  version_number: integer('version_number').notNull(),
  type: text('type').notNull(),
  chords: text('chords'),
  contributor: text('contributor').default('Colaborador'),
  content: text('content').notNull(),
  source_url: text('source_url').notNull().unique(),
  archive_url: text('archive_url').notNull(),
  is_best: boolean('is_best').default(false),
  scraped_at: timestamp('scraped_at').defaultNow(),
  song_code: text('song_code'),
  album: text('album'),
  year: integer('year'),
  composers: text('composers'),
  contributor_id: text('contributor_id')
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  role: text('role').default('user')
});

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  user_id: integer('user_id').notNull(),
  created_at: timestamp('created_at').defaultNow()
});

export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  song_id: integer('song_id').notNull(),
  is_awesome: boolean('is_awesome').default(false),
  created_at: timestamp('created_at').defaultNow()
});

export const failedUrls = pgTable('failed_urls', {
  id: serial('id').primaryKey(),
  url: text('url').notNull().unique(),
  error_message: text('error_message'),
  failed_at: timestamp('failed_at').defaultNow(),
  retry_count: integer('retry_count').default(0),
  resolved: boolean('resolved').default(false)
});
