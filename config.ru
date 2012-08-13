require './lib/server'

use Rake::Pipeline::Middleware, "Assetfile"

run Sinatra::Application
