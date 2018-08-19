var gulp = require('gulp');
var gutil = require('gulp-util');
const uglify = require('gulp-uglifyes');
const template = require('gulp-template');

function getTemplateVars() {
    return {
        host: process.env.ENV === 'prd' ? `https://offline-js13k-2018.herokuapp.com:${process.env.PORT}` : 'http://localhost:3000'
    };
}

let templateVars = getTemplateVars();

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
        .pipe(template(templateVars))
        .pipe(gulp.dest('public/'))
})

gulp.task('html-minify', function() {
    gulp.src("src/*.html")
        .pipe(template(templateVars))
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
});

gulp.task('compile', function() {
    gulp.run('scripts-minify', 'html-minify')
})