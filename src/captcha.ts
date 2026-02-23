import { Message } from "discord.js";

const NEW_USER_THRESHOLD = 1000 * 60 * 60 * 24 * 7; // one week

const substrs = [
    "first come first serve",
    "condition",
    "free",
    "need of it",
    "dm",
    "everyone"
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

    if (timeSinceJoinedMs < NEW_USER_THRESHOLD) {
        const content = clean(m.content);
        let occurrences = substrs.reduce((count, sub) => {
            return content.includes(sub.toLowerCase())
            ? count + 1
            : count;
        }, 0);

        if (m.attachments.size > 0) occurrences++;
        if (content.length > 200) occurrences++;

        if (occurrences > 2) {
            return true;
        }
    }
    return false;
}
