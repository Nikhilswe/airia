require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PdfText'
  s.version        = package['version']
  s.summary        = 'Native PDF text extraction for AIrIA'
  s.description    = 'Extracts text from PDFs using PDFKit, which pdf.js cannot do under Hermes.'
  s.license        = 'MIT'
  s.author         = 'AIrIA'
  s.homepage       = 'https://github.com/Nikhilswe/airia'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/Nikhilswe/airia.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
