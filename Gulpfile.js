var gulp = require('gulp');
var gutil = require('gulp-util');
const uglify = require('gulp-uglifyes');

gulp.task('scripts', function() {
    gulp.src(['src/**/*.js'])
        .pipe(gulp.dest('public/'))
})

gulp.task('scripts-minify', function() {
    gulp.src(['src/**/*.js'])
        .pipe(uglify({
            mangle: true,
            ecma: 6
         }))
        .on('error', function (err) { gutil.log(gutil.colors.red('[Error]'), err.toString()); })
        .pipe(gulp.dest('public/'))
})

gulp.task('html', function() {
    gulp.src("src/*.html")
        .pipe(gulp.dest('public/'))
})

gulp.task('html-minify', function() {
    gulp.src("src/*.html")
        // .pipe(minify())
        .pipe(gulp.dest('public/'))
})

gulp.task('default', function() {
    gulp.run('scripts', 'html');

    gulp.watch('src/**/*.js', function(event) {
        gulp.run('scripts');
    })

    gulp.watch('src/**/*.html', function(event) {
        gulp.run('html');
    })
})

gulp.task('compile', function() {
    gulp.run('scripts-minify', 'html-minify')
})