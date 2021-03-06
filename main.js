require('dotenv').config({ path: '.env' });
const fs = require('fs');
const { Client, Intents, Collection, Message } = require('discord.js');
const Enmap = require('enmap');
const path = require('path');
const util = require('util');

client = new Client({ intents: [Intents.FLAGS.GUILDS] });
client.commands = new Collection();
client.handlers = [];
client.command_data = new Enmap({
	fetchAll: true,
	autoFetch: true,
	cloneLevel: 'deep',
	autoEnsure: { ids: {} }
});

// enmap to store user data (at the moment, game stats)
client.user_data = new Enmap({
	name: 'user_data',
	fetchAll: false,
	autoFetch: true,
	cloneLevel: 'deep'
});
client.cooldowns = new Collection(); // stores the last time a user used a command
// per-guild settings
client.guild_data = new Enmap({
	name: 'guild_data',
	fetchAll: false,
	autoFetch: true,
	cloneLevel: 'deep',
	autoEnsure: {} // default settings for new guilds go in here
});

// settings for scheduled tasks such as preventing auto-archiving threads
client.scheduled_settings = new Enmap({
	name: 'scheduled_tasks',
	fetchAll: true,
	autoFetch: true,
	cloneLevel: 'deep'
});

// get a random integer between min (inclusive) and max (exclusive)
getRandomInt = function (min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
};

// load all the commands found in the commands folder
function addGuilds(commandModule, guilds, ...parentModules) {
	commandModule.guilds = commandModule.guilds ?? [];
	for (const guildId of guilds) {
		if (!commandModule.guilds.includes(guildId))
			commandModule.guilds.push(guildId);
		for (const parentModule of parentModules) {
			if (parentModule.guilds && !parentModule.guilds.includes(guildId))
				parentModule.guilds.push(guildId);
		}
	}
}

function mergeModules(commandModule, module, split, ...parentModules) {
	if (split.length === 1) {
		if (module.description) commandModule.description = module.description;
		if (module.cooldown) commandModule.cooldown = module.cooldown;
		if (module.guild_only) commandModule.guild_only = true;
		if (module.options) {
			commandModule.options = commandModule.options ?? [];
			commandModule.options.push(...module.options);
		}
		if (module.executors ?? module.execute) {
			commandModule.executors = commandModule.executors ?? [];
			const executors = module.executors ?? [];
			if (module.execute) executors.push(module.execute);
			commandModule.executors.push(...executors);
		}
		if (module.guilds)
			addGuilds(commandModule, module.guilds, ...parentModules);
	} else {
		split.shift();
		parentModules.unshift(commandModule);
		commandModule.subCommands = commandModule.subCommands ?? {};
		const subCommandName = split[0];
		commandModule.subCommands[subCommandName] = commandModule.subCommands[
			subCommandName
		] ?? { name: subCommandName };
		const subCommandModule = commandModule.subCommands[subCommandName];
		mergeModules(subCommandModule, module, split, ...parentModules);
	}
}

function searchModule(module) {
	if (Array.isArray(module)) {
		for (const subModule of module) {
			searchModule(subModule);
		}
	} else if (typeof module === 'function') {
		client.handlers.push(module);
	} else if (typeof module === 'object' && typeof module.name === 'string') {
		const split = module.name.split(' ');
		const commandName = split[0];
		if (!client.commands.has(commandName))
			client.commands.set(commandName, {
				name: commandName,
				description: module.description
			});
		const commandModule = client.commands.get(commandName);
		mergeModules(commandModule, module, split);
	}
}

function searchFolder(folderPath) {
	const childNames = fs.readdirSync(folderPath);
	for (const childName of childNames) {
		const subPath = path.resolve(folderPath, childName);
		const stats = fs.statSync(subPath);
		if (stats.isDirectory()) {
			searchFolder(subPath);
		} else if (stats.isFile() && subPath.endsWith('.js')) {
			const module = require(subPath);
			searchModule(module);
		}
	}
}
searchFolder('./commands');

// PERMISSIONS STUFF STARTS HERE //
// get a permissions array for a specific command in a specific guild
async function getCommandPermissions(guild, commandModule) {
	// get the @eveoyone role
	const everyoneRole = guild.roles.everyone;

	// if there are no required permissions, allow permission for everyone
	if (!commandModule.permissions)
		return [{ id: everyoneRole.id, type: 'ROLE', permission: true }];

	// if the bot doesn't have the required permissions, deny permission for everyone
	if (commandModule.permissions.bot) {
		const botMember = await guild.members.fetch(client.user.id);
		if (!botMember.permissions.has(commandModule.permissions.bot))
			return [{ id: everyoneRole.id, type: 'ROLE', permission: false }];
	}

	// if there are no required permissions for members, allow permission for everyone (we now know that the bot has the required permissions)
	if (!commandModule.permissions.member)
		return [{ id: everyoneRole.id, type: 'ROLE', permission: true }];

	// find permissions per-role, but also allow the guild owner to execute the command
	const commandPermissions = [
		{ id: guild.ownerId, type: 'USER', permission: true }
	];

	const roles = guild.roles.cache;
	for (const roleId of roles.keys()) {
		const role = roles.get(roleId);

		if (role.permissions.has(commandModule.permissions.member)) {
			commandPermissions.push({ id: roleId, type: 'ROLE', permission: true });
		}
	}

	return commandPermissions;
}

function getCommandId(name, guildId) {
	const id = client.command_data.get(name, 'id');
	if (id !== undefined) return id;
	return client.command_data.get(name, `ids.${guildId}`);
}

function getCommandById(id, guildId) {
	// *returns a promise*
	client.application.commands.fetch(commandId, { guildId: guild.id });
}

// get permissions array for all commands in a guild (guild & global)
async function getGuildPermissions(guild) {
	const permissions = [];

	// for each command
	for (const commandName of client.commands.keys()) {
		const commandModule = client.commands.get(commandName);
		const commandId = getCommandId(commandName, guild.id);
		if (commandId === undefined) continue;
		const commandPermissions = await getCommandPermissions(
			guild,
			commandModule
		); // get the command's permissions within the guild
		permissions.push({ id: commandId, permissions: commandPermissions }); // push those permissions to the array
	}

	return permissions;
}

// update the slash command permissions for a specific guild
async function updateGuildPermissions(guildId) {
	const guild = await client.guilds.fetch(guildId);
	const guildPermissions = await getGuildPermissions(guild);
	client.application.commands.permissions.set({
		guild: guildId,
		fullPermissions: guildPermissions
	});
}

// when the bot's permissions change in a guild, recalculate some permissions
async function botPermissionsChanged(botMember, oldPermissions) {
	const guild = botMember.guild;
	const everyoneRole = guild.roles.everyone;

	// for each command
	for (const commandName of client.commands.keys()) {
		const commandModule = client.commands.get(commandName);
		const commandId = getCommandId(commandName, guild.id);
		if (commandId === undefined) continue;
		if (!commandModule.permissions || !commandModule.permissions.bot) continue; // if the command doesn't have bot permissions we can ignore it
		const botHasPermissions = botMember.permissions.has(
			commandModule.permissions.bot
		); // does the bot NOW have the required permissions?
		if (
			oldPermissions &&
			botHasPermissions === oldPermissions.has(commandModule.permissions.bot)
		)
			continue; // if we knew what the permissions were beforehand and therefore nothing's changed, move on
		if (botHasPermissions) {
			const commandPermissions = await getCommandPermissions(
				guild,
				commandModule
			); // get the command permissions
			await client.application.commands.permissions.set({
				command: commandId,
				guild: guild.id,
				commandpermissions: commandPermissions
			});
		} else {
			await command.permissions.set({
				permissions: [{ id: everyoneRole.id, type: 'ROLE', permission: false }]
			}); // deny permission for everyone
		}
	}
}

// when the bot's permissions change, we need to recalculate permissions (the bot denies access to commands it can't execute)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
	if (newMember.id !== client.user.id) return;
	const oldPermissions = oldMember.permissions;
	const newPermissions = newMember.permissions;
	if (newPermissions.equals(oldPermissions)) return; // no changes to permissions: ignore
	await botPermissionsChanged(newMember, oldPermissions);
});

// check if a role's permissions have changed for a specific command
async function checkRolePermissions(role, command, botMember) {
	const commandModule = client.commands.get(command.name);
	if (!commandModule.permissions) return; // if the command doesn't have any permissions, move on
	// if there is a lack of bot permissions OR member permissions, deny permission
	if (
		(commandModule.permissions.bot &&
			!botMember.permissions.has(commandModule.permissions.bot)) ||
		(commandModule.permissions.member &&
			!role.permissions.has(commandModule.permissions.member))
	) {
		await command.permissions.remove({ guild: role.guild.id, roles: role.id });
	} else {
		await command.permissions.add({
			guild: role.guild.id,
			permissions: [{ id: role.id, type: 'ROLE', permission: true }]
		}); // otherwise, allow permission for this role
	}
}

client.on('roleUpdate', async (oldRole, newRole) => {
	// if a role is updated, the permissions will need to be updated
	const oldPermissions = oldRole.permissions;
	const newPermissions = newRole.permissions;
	if (newPermissions.equals(oldPermissions)) return; // no changes to permissions: ignore
	// does the change to this role affect the bot's permissions? (we don't know for sure but if they are involved, probably)
	const guild = newRole.guild;
	if (
		oldRole.members.has(client.user.id) ||
		newRole.members.has(client.user.id)
	) {
		const botMember = await guild.members.fetch(client.user.id);
		await botPermissionsChanged(botMember);
	}
	const botMember = await guild.members.fetch(client.user.id);

	// for each command
	for (const commandName of client.commands.keys()) {
		const commandId = getCommandId(commandName, guild.id);
		if (commandId === undefined) continue;
		const command = getCommandById(commandId, guild.id);
		await checkRolePermissions(newRole, command, botMember);
	}
});

// when added to a guild
client.on('guildCreate', async guild => {
	// create an array of the guild-specific commands for this guild
	const guildCommands = [];
	for (const commandName of client.commands.keys()) {
		const commandModule = client.commands.get(commandName);
		if (!commandModule.guilds || !commandModule.guilds.includes(guild.id))
			continue;
		const requestData = {
			name: commandName,
			description: commandModule.description,
			options: commandModule.options || undefined,
			defaultPermission: !commandModule.guild_only // if the command is only for guilds, prevent access by default (in DMs)
		};
		guildCommands.push(requestData);
	}
	const guildApplicationCommands = await client.application.commands.set(
		guildCommands,
		guild.id
	); // set these commands on discord

	// update the application command ids in the collection of command data
	for (const commandId of guildApplicationCommands.keys()) {
		const guildApplicationCommand = guildApplicationCommands.get(commandId);
		const commandName = guildApplicationCommand.name;
		client.command_data.set(commandName, commandId, `ids.${guildId}`);
	}
	await updateGuildPermissions(guild.id); // update the command permissions for this new guild
});

function getSlashCommandData(
	commandModule,
	subCommand = false,
	group = true,
	...options
) {
	const commandData = {
		name: commandModule.name,
		description: commandModule.description
	};
	if (subCommand) {
		commandData.type =
			group && commandModule.subCommands ? 'SUB_COMMAND_GROUP' : 'SUB_COMMAND';
	}
	if (commandModule.options) options.push(...commandModule.options);
	if (commandModule.subCommands) {
		commandData.options = [];
		for (const subCommandModule of Object.values(commandModule.subCommands)) {
			commandData.options.push(
				getSlashCommandData(subCommandModule, true, !subCommand, ...options)
			);
		}
	} else {
		commandData.options = options || undefined;
	}
	return commandData;
}

// update all slash commands on discord
async function updateAllSlashCommands() {
	// build arrays of global commands and guild commands
	const globalCommands = [];
	const guildCommands = {};
	const guilds = await client.guilds.fetch();
	for (const guildId of guilds.keys()) {
		// add a guild commands array for each guild the client is in
		guildCommands[guildId.toString()] = [];
	}
	for (const commandName of client.commands.keys()) {
		// for each of the commands in the collection
		const commandModule = client.commands.get(commandName); // get the command
		const requestData = getSlashCommandData(commandModule);
		if (commandModule.guilds) {
			// if this command is specific to certain guilds
			for (let i = 0; i < commandModule.guilds.length; i++) {
				// only push it to the arrays for those guilds
				const guildId = commandModule.guilds[i];
				guildCommands[guildId]?.push(requestData);
			}
		} else {
			// otherwise
			globalCommands.push(requestData); // add it to the global commands
		}
	}
	for (const guildId of guilds.keys()) {
		// for each guild
		const guildApplicationCommands = await client.application.commands.set(
			guildCommands[guildId],
			guildId
		);

		for (const commandId of guildApplicationCommands.keys()) {
			// update command data with the command ids that got returned
			const guildApplicationCommand = guildApplicationCommands.get(commandId);
			const commandName = guildApplicationCommand.name;
			client.command_data.set(commandName, commandId, `ids.${guildId}`);
		}
	}
	const globalApplicationCommands = await client.application.commands.set(
		globalCommands
	); // update the global slash commands (discord takes up to 1 hour to do this in every server)
	for (const commandId of globalApplicationCommands.keys()) {
		const globalApplicationCommand = globalApplicationCommands.get(commandId);
		const commandName = globalApplicationCommand.name;
		client.command_data.set(commandName, commandId, `id`);
	}
}

client.once('ready', async () => {
	// when the bot logs in
	if (!client.application?.owner) await client.application?.fetch(); // idk the guide says this is necessary

	await updateAllSlashCommands();

	for (const guildId of client.guilds.cache.keys()) {
		// for each guild
		await updateGuildPermissions(guildId); // update their slash command permissions
	}
});

client.on('interactionCreate', async interaction => {
	// when an interaction occurs (we're interested in slash command interactions)
	if (!interaction.isCommand()) {
		if (!interaction.isMessageComponent) return;
		for (const handler of client.handlers) {
			try {
				const result = await handler(interaction);
				if (result) return result;
			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					// prevent 'already replied' errors
					await interaction.editReply(
						'An error occurred while handling your interaction.'
					);
				} else {
					await interaction.reply({
						content: 'An error occurred while handling your interaction.',
						ephemeral: true
					});
				}
				return error;
			}
		}
		return;
	}

	const commandName = interaction.commandName;

	const commandModule = client.commands.get(commandName); // find the command in the collection

	if (!commandModule) return; // this would be problematic (most likely to happen if global commands haven't updated yet - but discord shouldn't send interactions for old commands so this is just a precaution)

	try {
		const result = await executeCommand(
			commandModule,
			interaction,
			commandName
		);
		if (result)
			processCooldown(commandModule, commandName, interaction.user.id);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			// prevent 'already replied' errors
			if (!interaction.deferred)
				return await interaction.followUp(
					'There was an error trying to execute that command!'
				);
			return await interaction.editReply(
				'There was an error trying to execute that command!'
			);
		} else {
			return await interaction.reply({
				content: 'There was an error trying to execute that command!',
				ephemeral: true
			});
		}
	}
});

function processCooldown(commandModule, commandName, userId) {
	if (!commandModule.cooldown) return;

	const now = Date.now();
	const timestamps = client.cooldowns.get(commandName);
	const cooldownAmount = commandModule.cooldown * 1000;

	timestamps.set(userId, now);
	setTimeout(() => timestamps.delete(userId), cooldownAmount);
}

async function executeCommand(
	commandModule,
	interaction,
	commandName,
	group = true
) {
	if (
		(commandModule.guild_only || commandModule.guilds) &&
		!interaction.inGuild()
	)
		return (
			(await interaction.reply({
				content: 'This command can only be used in a server.',
				ephemeral: true
			})) && false
		); // handle guild only commands (currently only /ping is non-guild)
	if (
		commandModule.guilds &&
		!commandModule.guilds.includes(interaction.guildId)
	)
		return (
			(await interaction.reply({
				content: `\`/${commandName}\` cannot be used in this server.`,
				ephemeral: true
			})) && false
		);

	if (interaction.inGuild() && commandModule.permissions) {
		if (
			commandModule.permissions.member &&
			!interaction.member
				.permissionsIn(interaction.channel)
				.has(commandModule.permissions.member)
		)
			return (
				(await interaction.reply({
					content: "You don't have permission to use that command.",
					ephemeral: true
				})) && false
			);
		if (commandModule.permissions.bot) {
			const botMember = await interaction.guild.members.fetch(client.user.id);
			if (
				!botMember
					.permissionsIn(interaction.channel)
					.has(commandModule.permissions.bot)
			)
				return (
					(await interaction.reply({
						content: "I don't have the required permissions for that command.",
						ephemeral: true
					})) && false
				);
		}
	}

	if (commandModule.threadOnly && !interaction.channel.isThread())
		return (
			(await interaction.reply({
				content: 'This command can only be used in a thread.',
				ephemeral: true
			})) && false
		);

	if (commandModule.cooldown) {
		if (!client.cooldowns.has(commandName)) {
			client.cooldowns.set(commandName, new Collection());
		}
		const timestamps = client.cooldowns.get(commandName);
		if (timestamps.has(interaction.user.id)) {
			const cooldownAmount = commandModule.cooldown * 1000;
			const now = Date.now();
			const expirationTime =
				timestamps.get(interaction.user.id) + cooldownAmount;

			if (now < expirationTime) {
				const timeLeft = (expirationTime - now) / 1000;
				return (
					(await interaction.reply({
						content: `Please wait ${timeLeft.toFixed(
							1
						)} more second(s) before reusing \`/${commandName}\``,
						ephemeral: true
					})) && false
				);
			}
		}
	}

	if (commandModule.executors) {
		for (const executor of commandModule.executors) {
			const result = await executor(interaction);
			if (result) return result;
		}
	}

	if (!interaction.options || !commandModule.subCommands) return;
	let subCommandName;
	if (group) subCommandName = interaction.options.getSubCommandGroup(false);
	if (!subCommandName)
		subCommandName = interaction.options.getSubCommand(false);
	if (!subCommandName) return;

	commandName += ' ' + subCommandName;

	const subCommandModule = commandModule.subCommands[subCommandName];
	if (!subCommandModule) return;
	const result = await executeCommand(
		subCommandModule,
		interaction,
		commandName,
		false
	);
	if (result) {
		processCooldown(subCommandModule, commandName, interaction.user.id);
		return result;
	}
}

const publicIp = require('public-ip');
const https = require('https');

setInterval(async function () {
	let ip = await publicIp.v4();
	https.get(
		`https://dynamicdns.park-your-domain.com/update?host=${process.env.DDNS_HOST}&domain=${process.env.DDNS_DOMAIN}&password=${process.env.DDNS_PASSWORD}&ip=${ip}`
	);
}, 30000);

const stayAwake = require('stay-awake');

const currentDate = new Date();

const startDate = new Date(currentDate.getTime());
startDate.setHours(9);
startDate.setMinutes(15);
startDate.setSeconds(0);

const endDate = new Date(currentDate.getTime());
endDate.setHours(22);
endDate.setMinutes(0);
endDate.setSeconds(0);

if (startDate < currentDate && currentDate < endDate) {
	stayAwake.prevent();
}

const cron = require('node-cron');

cron.schedule('15 9 * * *', () => {
	stayAwake.prevent();
});

cron.schedule('0 22 * * *', () => {
	stayAwake.allow();
});

client.login(process.env.BOT_TOKEN);
