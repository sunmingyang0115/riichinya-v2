import { Message } from "discord.js";

const ONE_DAY = 1000 * 60 * 60 * 24;

function testFormat(time: number) {
    const seconds = Math.floor(time / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const formattedTime = `${days} days, ${hours % 24} hours, ${minutes % 60} minutes, ${seconds % 60} seconds`;
    console.log(formattedTime);
}

const substrs = [
    "first come first serve",
    "condition",
    "free",
    "need of it",
    "dm",
]

function clean(text: string) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]|_/g, '')   // remove punctuation
      .replace(/\s+/g, ' ')        // remove extra spaces
      .trim();                     // remove leading/trailing space
}

// checks if it's one of those laptop scammers
export function checkIfScammer(m: Message) {
    if (m.author.bot) return;   // wrong type of bot
    if ( m.member == null || m.member?.joinedTimestamp == null) return;
    const timeSinceJoinedMs = Date.now() - m.member!.joinedTimestamp!;

    if (timeSinceJoinedMs < ONE_DAY) {
        const content = clean(m.content);
        let occurrences = substrs.reduce((count, sub) => {
            return content.includes(sub.toLowerCase())
            ? count + 1
            : count;
        }, 0);

        if (m.attachments.size > 0) occurrences++;
        if (content.length > 200) occurrences++;

        if (occurrences > 3) {
            return true;
        }
    }
    return false;
}
