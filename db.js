import sqlite3 from 'sqlite3';
import fs from 'fs';

sqlite3.verbose();

const db = new sqlite3.Database('./angelcase.db');
const initSql = fs.readFileSync('./init.sql', 'utf8');

db.exec(initSql);

export default db;
