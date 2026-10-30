// Bible books (.bible), the prayers (.prayers), the hymn texts (.hymns) and the
// Synaxarium (.synax) ship as assets and are read on demand.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bible', 'prayers', 'hymns', 'synax');

module.exports = config;
