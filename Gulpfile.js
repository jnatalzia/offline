var gulp = require('gulp');
var gutil = require('gulp-util');
const template = require('gulp-template');
var uglifyjs = require('uglify-es');
var composer = require('gulp-uglify/composer');
var pump = require('pump');

var minify = composer(uglifyjs, console);

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

gulp.task('scripts-minify', function(cb) {
    var options = {
        mangle: true
    };

    pump([
        gulp.src(['src/**/*.js']),
        minify(options),
        gulp.dest('public/')
    ],
    cb
    );
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