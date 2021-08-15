module.exports = {
	name: 'prevent archive',
	description: 'Prevent a thread from being auto-archived',
	cooldown: 30,
	guild_only: true,
	permissions: {
		member: ['MANAGE_THREADS'],
		bot: ['MANAGE_THREADS']
	},
	options: [
		{
			name: 'thread',
			type: 'CHANNEL',
			description: 'The thread in which to prevent auto-archiving',
			required: true
		}
	],
	async execute(interaction) {
		await interaction.defer({ ephemeral: true });
		const thread = interaction.options.getChannel('thread', true);
		if (!thread.isThread())
			return interaction.editReply('The channel specified must be a thread.');

		const threadIds = client.scheduled_settings.get('unarchive_threads');
		if (threadIds.includes(thread.id)) {
			threadIds.splice(threadIds.indexOf(thread.id), 1);
		} else {
			try {
				await thread.setArchived(false);
				await thread.setAutoArchiveDuration(1440, 'Preventing auto-archive');
			} catch (error) {
				return await interaction.editReply(
					"I couldn't unarchive that channel."
				);
			}
			threadIds.push(thread.id);
		}
		client.scheduled_settings.set('unarchive_threads', threadIds);
		if (threadIds.includes(thread.id)) {
			return (
				(await interaction.editReply(
					`Now preventing auto-archive in <#${thread.id}>!`
				)) || true
			);
		}
		return (
			(await interaction.editReply(
				`No longer preventing auto-archive in <#${thread.id}>.`
			)) || true
		);
	}
};
