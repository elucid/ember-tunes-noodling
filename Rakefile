require './lib/init'

desc "Run the server"
task :server do
  system "rackup config.ru"
end

desc "Build assets"
task :build do
  puts "Building..."
  Rake::Pipeline::Project.new("Assetfile").invoke
  puts "Done"
end
