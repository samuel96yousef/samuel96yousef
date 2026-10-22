// Bible books ship as assets with a .bible extension and are read on demand.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bible');

module.exports = config;
