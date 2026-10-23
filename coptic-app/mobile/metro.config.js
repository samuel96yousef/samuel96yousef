// Bible books (.bible) and the prayers (.prayers) ship as assets and are read on demand.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bible', 'prayers');

module.exports = config;
