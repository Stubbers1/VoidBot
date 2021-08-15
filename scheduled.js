// task scheduler will set this script to run every 9:00AM & 9:00PM
require('dotenv').config({ path: '.env' });

const { Client } = require('discord.js');
client = new Client({ intents: [] });

const Enmap = require('enmap');

client.scheduled_settings = new Enmap({
	name: 'scheduled_tasks',
	fetchAll: true,
	autoFetch: true,
	cloneLevel: 'deep'
});

client.on('ready', async () => {
	const threadIds = client.scheduled_settings.get('unarchive_threads');

	for (let i = threadIds.length - 1; i >= 0; i--) {
		const threadId = threadIds[i];

		const thread = await client.channels.fetch(threadId);
		if (!thread || !thread.isThread() || thread.archived) {
			threadIds.splice(i, 1);
			continue;
		}
		try {
			await thread.setAutoArchiveDuration(60, 'Preventing auto-archive');
			await thread.setAutoArchiveDuration(1440, 'Preventing auto-archive');
		} catch (error) {}
	}

	client.scheduled_settings.set('unarchive_threads', threadIds);

	client.destroy();
});

client.login(process.env.BOT_TOKEN);
