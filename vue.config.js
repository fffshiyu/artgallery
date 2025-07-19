const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  lintOnSave: false,
  devServer: {
    hot: false,
    liveReload: false,
    inline: false
  },
  chainWebpack: config => {
    // 禁用所有资源文件的hash后缀
    config.module
      .rule('images')
      .use('url-loader')
      .tap(options => {
        return {
          ...options,
          name: 'img/[name].[ext]',
          fallback: {
            loader: 'file-loader',
            options: {
              name: 'img/[name].[ext]'
            }
          }
        };
      });
      
    // 禁用媒体文件的hash后缀  
    config.module
      .rule('media')
      .use('url-loader')
      .tap(options => {
        return {
          ...options,
          name: 'media/[name].[ext]',
          fallback: {
            loader: 'file-loader',
            options: {
              name: 'media/[name].[ext]'
            }
          }
        };
      });
      
    // 禁用字体文件的hash后缀
    config.module
      .rule('fonts')
      .use('url-loader')
      .tap(options => {
        return {
          ...options,
          name: 'fonts/[name].[ext]',
          fallback: {
            loader: 'file-loader',
            options: {
              name: 'fonts/[name].[ext]'
            }
          }
        };
      });
      
    // 🔥 新增：复制art目录下的图片文件到生产环境
    config.plugin('copy-art-images').use(CopyWebpackPlugin, [
      [
        {
          from: 'src/assets/image/art',
          to: 'img',
          noErrorOnMissing: true
        }
      ]
    ]);
  }
};
