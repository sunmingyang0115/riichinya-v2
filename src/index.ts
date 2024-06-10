import 'dotenv/config';
import { Bot } from './data/bot';

const riichinya = new Bot(process.env.TOKEN);
riichinya.run();

