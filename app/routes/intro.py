from flask import Blueprint, render_template, session, redirect, url_for, flash
from app.models import db
from app.services.progress_service import mark_module_completed, update_module_progress_percent
from app.services.state_service import persist_learning_state
from app.services.theory_service import get_theory_content_by_module_name

intro_bp = Blueprint('intro', __name__)

@intro_bp.route('/intro')
def intro():
    user_id = session.get('user_id')
    if not user_id:
        flash('Session missing. Please login to continue.', 'error')
        return redirect(url_for('auth.login'))

    mark_module_completed(user_id, 'intro')
    update_module_progress_percent(user_id, "Intro", 100, completed=True)
    persist_learning_state(user_id, current_module_name="Intro", last_route="/intro")
    db.session.commit()

    theory_content = get_theory_content_by_module_name("Intro")
    return render_template('intro.html', theory_content=theory_content)
