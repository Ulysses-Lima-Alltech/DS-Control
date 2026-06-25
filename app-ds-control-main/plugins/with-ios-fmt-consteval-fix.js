const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('@expo/config-plugins');

const START_MARKER = '# DS_CONTROL_FMT_CONSTEVAL_FIX_START';
const END_MARKER = '# DS_CONTROL_FMT_CONSTEVAL_FIX_END';
const MACRO = 'FMT_USE_CONSTEVAL=0';
const CPP_FLAG = `-D${MACRO}`;
const POST_INSTALL_PATTERN = /post_install do \|installer\|/;
const MARKED_BLOCK_PATTERN = new RegExp(
  `\\n?\\s*${START_MARKER}[\\s\\S]*?${END_MARKER}\\n*`,
  'm'
);
const LEGACY_BLOCK_PATTERN =
  /\n?  # DS Control: workaround for fmt consteval failures on newer Xcode toolchains\.\n  installer\.pods_project\.targets\.each do \|target\|\n    next unless target\.name == 'fmt' \|\| target\.name\.downcase\.include\?\('fmt'\)\n\n    target\.build_configurations\.each do \|config\|\n      definitions = config\.build_settings\['GCC_PREPROCESSOR_DEFINITIONS'\] \|\| \['\$\(inherited\)'\]\n      definitions = \[definitions\] if definitions\.is_a\?\(String\)\n      definitions << 'FMT_USE_CONSTEVAL=0' unless definitions\.include\?\('FMT_USE_CONSTEVAL=0'\)\n      config\.build_settings\['GCC_PREPROCESSOR_DEFINITIONS'\] = definitions\n    end\n  end\n?/m;

const FMT_CONSTEVAL_FIX = `  ${START_MARKER}
  fmt_base_header = File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base_header)
    fmt_base_contents = File.read(fmt_base_header)
    patched_fmt_base_contents = fmt_base_contents.gsub(
      /#\\s*define\\s+FMT_USE_CONSTEVAL\\s+1/,
      '#  define FMT_USE_CONSTEVAL 0'
    )
    File.write(fmt_base_header, patched_fmt_base_contents) if patched_fmt_base_contents != fmt_base_contents
  end

  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      definitions = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
      definitions = definitions.split(/\\s+/) if definitions.is_a?(String)
      definitions << '$(inherited)' unless definitions.include?('$(inherited)')
      definitions << '${MACRO}' unless definitions.include?('${MACRO}')
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = definitions

      cxx_flags = config.build_settings['OTHER_CPLUSPLUSFLAGS'] || ['$(inherited)']
      cxx_flags = cxx_flags.split(/\\s+/) if cxx_flags.is_a?(String)
      cxx_flags << '$(inherited)' unless cxx_flags.include?('$(inherited)')
      cxx_flags << '${CPP_FLAG}' unless cxx_flags.include?('${CPP_FLAG}')
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] = cxx_flags
    end
  end
  ${END_MARKER}
`;

function removeExistingFix(contents) {
  return contents.replace(MARKED_BLOCK_PATTERN, '\n').replace(LEGACY_BLOCK_PATTERN, '\n');
}

function addFmtConstevalFix(contents) {
  const cleanContents = removeExistingFix(contents);

  if (POST_INSTALL_PATTERN.test(cleanContents)) {
    return cleanContents.replace(
      POST_INSTALL_PATTERN,
      (match) => `${match}\n${FMT_CONSTEVAL_FIX}`
    );
  }

  return `${cleanContents.trimEnd()}

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
