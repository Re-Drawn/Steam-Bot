const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js')
const { getUser, getUserGames, searchUser, getApp } = require('../../fetch_api.js')

async function createUserEmbed(userRaw) {
    const embed = new EmbedBuilder()
    .setAuthor({ name: `${userRaw.persona_name}`, url: `https://steamcommunity.com/profiles/${userRaw.steamid}`, iconURL: `https://avatars.akamai.steamstatic.com/${userRaw.avatar_url}_full.jpg`})
    .setDescription(`Steam ID: ${userRaw.steamid}`)
    return embed
}

async function createEmbed(isPrivate, userRaw, gamesRaw, pricesRaw) {

    if (!isPrivate) {
        let gameHours = ""
        let totalPrice = 0
        let salePrice = 0

        for (let i = -1; i > -10; i--) {
            gameHours = gameHours.concat(`${-i}. ${gamesRaw.games.at(i).name}: ${Math.round(gamesRaw.games.at(i).playtime_forever/60*100)/100} hours`, "\n")
        }
        gameHours = gameHours.concat(`10. ${gamesRaw.games.at(-10).name}: ${Math.round(gamesRaw.games.at(-10).playtime_forever/60*100)/100} hours`)

        for (app in pricesRaw) {
            if (pricesRaw[app].success) {
                // TODO: Clean this up
                if (!Array.isArray(pricesRaw[app].data)) {
                    totalPrice = totalPrice + pricesRaw[app].data.price_overview.initial
                    salePrice = salePrice + pricesRaw[app].data.price_overview.final
                }
            }
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${userRaw.persona_name}`, url: `https://steamcommunity.com/profiles/${userRaw.steamid}`, iconURL: `https://avatars.akamai.steamstatic.com/${userRaw.avatar_url}_full.jpg`})
            .setDescription(`Steam ID: ${userRaw.steamid}\nGames owned: ${gamesRaw.game_count}`)
            .addFields(
                { name: 'Top Games by hours: ', value: `${gameHours}`, inline: true},
                { name: 'Price of library (without sales):', value: `$${totalPrice/100} USD`, inline: true},
                { name: 'Price of library (with sales):', value: `$${salePrice/100} USD`, inline: true}
            )
        
        return embed
    } else {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${userRaw.persona_name}`, url: `https://steamcommunity.com/profiles/${userRaw.steamid}`, iconURL: `https://avatars.akamai.steamstatic.com/${userRaw.avatar_url}_full.jpg`})
            .setDescription(`**This user's profile is private!**\nIf this is your profile, follow the link below and uncheck the 'Always keep my total playtime private' option.\nhttps://steamcommunity.com/my/edit/settings\n*Please wait a couple minutes after changing the setting for this to update!*`)
        return embed
    }

}

// TODO: Change command to be a general user stats command for account worth (in games), steam level, top games, recent games, etc.
module.exports = {
    data: new SlashCommandBuilder()
    .setName('getuserhours')
    .setDescription("Find a user's hours on Steam!")
    .addStringOption(option =>
        option.setName('username')
            .setDescription('The username or steamid number of the user you want to search for')
            .setRequired(true)),

    // TODO: Get faster execution time on command
    async execute(interaction) {
        await interaction.deferReply()
        const searchInput = interaction.options.get('steamid').value
        // TODO: Clean this up for searching with steamID (this is section of code is a repeat of below)
        if (typeof(parseInt(searchInput)) === "number") {
            const userRaw = await getUser(searchInput)
            if (userRaw) {
                const games = await getUserGames(userRaw.steamid)

                if (games) {
                    let ids = []
                    for (let i = 0; i < games.games.length; i++) {
                        ids.push(games.games[i].appid)
                    }
                    const prices = await getApp(ids)
                    embed = await createEmbed(false, userRaw, games, prices)
                    await interaction.editReply( { content: '', embeds: [embed], components: [] })
                } else {
                    embed = await createEmbed(true, userRaw)
                    await interaction.editReply( { content: '', embeds: [embed], components: [] })
                }
                return
            }
        }
        const usersRaw = await searchUser(searchInput)

        if (usersRaw.length == 1) {
            let userRaw = await getUser(usersRaw[0])
            const games = await getUserGames(userRaw.steamid)

            if (games) {
                embed = await createEmbed(false, userRaw, games)
                await interaction.editReply( { content: '', embeds: [embed], components: [] })
            } else {
                embed = await createEmbed(true, userRaw)
                await interaction.editReply( { content: '', embeds: [embed], components: [] })
            }
        } else if (usersRaw.length > 0) {
            let userNumber = 0
            let userRaw = await getUser(usersRaw[userNumber])
        
            const yes = new ButtonBuilder()
                .setCustomId('yes')
                .setLabel('Yes')
                .setStyle(ButtonStyle.Primary)
            const no = new ButtonBuilder()
                .setCustomId('no')
                .setLabel('No')
                .setStyle(ButtonStyle.Danger)
            const buttons = new ActionRowBuilder()
                .addComponents(yes, no)
            
            let embed = await createUserEmbed(userRaw)
            const message = await interaction.editReply({ content: `Is this the right user?`, embeds: [embed], components: [buttons]})
            
            const filter = (interaction) => interaction.customId === 'yes' || interaction.customId === 'no'
            const collector = message.createMessageComponentCollector({ filter, time: 60_000 });
        
            collector.on('collect', async i => {
                await i.deferUpdate()
                if (i.user.id === interaction.user.id) {
                    if (i.customId === 'yes') {
                        // TODO: Clean up games.games to just games
                        const games = await getUserGames(userRaw.steamid)

                        if (games) {
                            let ids = []
                            for (let i = 0; i < games.games.length; i++) {
                                ids.push(games.games[i].appid)
                            }
                            const prices = await getApp(ids)
                            embed = await createEmbed(false, userRaw, games, prices)
                            await interaction.editReply( { content: '', embeds: [embed], components: [] })
                        } else {
                            embed = await createEmbed(true, userRaw)
                            await interaction.editReply( { content: '', embeds: [embed], components: [] })
                        }
                    } else if (i.customId === 'no') {
                        if (userNumber < usersRaw.length-1) {
                            userNumber = userNumber + 1
                            userRaw = await getUser(usersRaw[userNumber])
                            embed = await createUserEmbed(userRaw)
                            await interaction.editReply({ embeds: [embed], components: [buttons]})
                        } else {
                            no.setLabel('No more results.').setDisabled(true)
                            await interaction.editReply({ embeds: [embed], components: [buttons]})
                        }
                    }
                    await collector.resetTimer()
                }
            })
        } else {
            await interaction.editReply(`Your search for user '${searchInput}' came up with no results. Please try again.`)
        }
    }
}
