const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('@expo/config-plugins');

const MACRO = 'FMT_USE_CONSTEVAL=0';
const POST_INSTALL_PATTERN = /post_install do \|installer\|/;

const FMT_CONSTEVAL_FIX = `  # DS Control: workaround for fmt consteval failures on newer Xcode toolchains.
  installer.pods_project.targets.each do |target|
    next unless target.name == 'fmt' || target.name.downcase.include?('fmt')

    target.build_configurations.each do |config|
      definitions = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
      definitions = [definitions] if definitions.is_a?(String)
      definitions << '${MACRO}' unless definitions.include?('${MACRO}')
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = definitions
    end
  end
`;

function addFmtConstevalFix(contents) {
  if (contents.includes(MACRO)) {
    return contents;
  }

  if (POST_INSTALL_PATTERN.test(contents)) {
    return contents.replace(POST_INSTALL_PATTERN, (match) => `${match}\n${FMT_CONSTEVAL_FIX}`);
  }

  return `${contents}

post_install do |installer|
${FMT_CONSTEVAL_FIX}end
`;
}

module.exports = function withIosFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      const contents = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, addFmtConstevalFix(contents));

      return config;
    },
  ]);
};
